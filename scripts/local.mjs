// Arranca la tienda en tu computadora con una base Postgres local (PGlite).
//
// PGlite solo admite un proceso por carpeta, pero Next.js usa varios procesos. Por eso este
// script abre la base UNA vez y atiende las consultas por HTTP en 127.0.0.1 (solo esta máquina,
// con un token aleatorio por arranque). Un candado ejecuta las consultas y transacciones de a una,
// así nunca se mezclan. Next recibe DATABASE_URL=pglite-http://… (ver src/server/db.ts).
//
// Uso: node scripts/local.mjs dev | start   (lo llaman `npm run dev` y `npm start`)

import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const mode = process.argv[2] === "start" ? "start" : "dev";
const PORT = Number(process.env.LOCAL_DB_PORT ?? 54329);
const TOKEN = randomBytes(24).toString("hex");
const TX_TIMEOUT_MS = 15_000;

mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
const db = await PGlite.create(path.join(process.cwd(), ".data", "pglite"));

// ---------- Candado: una consulta o transacción a la vez ----------
let busy = Promise.resolve();
function lock() {
  let release;
  const next = new Promise((r) => (release = r));
  const ready = busy.then(() => release);
  busy = busy.then(() => next);
  return ready;
}

const txs = new Map(); // txId → { release, timer }

async function endTx(id, commit) {
  const t = txs.get(id);
  if (!t) return false;
  txs.delete(id);
  clearTimeout(t.timer);
  try {
    await db.query(commit ? "COMMIT" : "ROLLBACK");
  } finally {
    t.release();
  }
  return true;
}

async function handle(body) {
  switch (body.op) {
    case "query": {
      if (body.tx) {
        if (!txs.has(body.tx)) throw new Error("La transacción ya terminó (tiempo agotado).");
        return (await db.query(body.sql, body.params ?? [])).rows;
      }
      const release = await lock();
      try {
        return (await db.query(body.sql, body.params ?? [])).rows;
      } finally {
        release();
      }
    }
    case "begin": {
      const release = await lock();
      const id = randomUUID();
      try {
        await db.query("BEGIN");
      } catch (e) {
        release();
        throw e;
      }
      // Si el cliente se cae a mitad de la transacción, se deshace sola y libera el candado.
      txs.set(id, { release, timer: setTimeout(() => endTx(id, false).catch(() => {}), TX_TIMEOUT_MS) });
      return id;
    }
    case "commit":
      return endTx(body.tx, true);
    case "rollback":
      return endTx(body.tx, false);
    default:
      throw new Error(`Operación desconocida: ${body.op}`);
  }
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401).end();
    return;
  }
  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const result = await handle(JSON.parse(raw));
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ result }));
    } catch (e) {
      res
        .writeHead(400, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: { message: e?.message ?? String(e), code: e?.code } }));
    }
  });
});

server.on("error", (e) => {
  console.error(
    e?.code === "EADDRINUSE"
      ? `El puerto ${PORT} está ocupado (¿la tienda ya está corriendo?). Ciérrala o usa otro puerto con LOCAL_DB_PORT.`
      : e,
  );
  db.close().finally(() => process.exit(1));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Base de datos local lista (.data/pglite) en 127.0.0.1:${PORT}`);
  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, mode, ...process.argv.slice(3)], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: `pglite-http://${TOKEN}@127.0.0.1:${PORT}` },
  });

  let closing = false;
  const shutdown = async (code = 0) => {
    if (closing) return;
    closing = true;
    child.kill();
    server.close();
    await db.close().catch(() => {});
    process.exit(code);
  };
  child.on("exit", (code) => shutdown(code ?? 0));
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
});
