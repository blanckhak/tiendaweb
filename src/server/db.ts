import "server-only";
import { unlinkSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type Row = Record<string, unknown>;
export type Query = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;

type Db = { query: Query; tx: <T>(fn: (q: Query) => Promise<T>) => Promise<T>; close: () => Promise<void> };

/**
 * Con DATABASE_URL (Supabase u otro Postgres) usa el driver `postgres`.
 * Sin ella usa PGlite: Postgres embebido que guarda los datos en .data/pglite.
 * `memory://` sirve para las pruebas.
 */
async function connect(url = process.env.DATABASE_URL): Promise<Db> {
  if (url?.startsWith("pglite-http://")) return httpClient(url);
  if (url && !url.startsWith("memory://") && !url.startsWith("pglite:")) {
    const { default: postgres } = await import("postgres");
    // prepare:false es necesario con el pooler de Supabase en modo transacción.
    const sql = postgres(url, { prepare: false, max: 5 });
    const wrap =
      (s: typeof sql): Query =>
      async <T,>(text: string, params: unknown[] = []) =>
        (await s.unsafe(text, params as never[])) as unknown as T[];
    return {
      query: wrap(sql),
      tx: (fn) => sql.begin((s) => fn(wrap(s as unknown as typeof sql))) as Promise<never>,
      close: () => sql.end(),
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  // PGlite no admite que dos procesos abran la misma carpeta: la base se daña.
  // Al compilar, Next prerenderiza con varios procesos a la vez, así que se compila con una
  // base en memoria (datos de ejemplo). npm_lifecycle_event lo heredan también los procesos auxiliares.
  const building = process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";
  const dir = url?.startsWith("pglite:") ? url.slice("pglite:".length) : path.join(process.cwd(), ".data", "pglite");
  let pg: InstanceType<typeof PGlite>;
  if (url?.startsWith("memory://") || building) {
    pg = new PGlite();
  } else {
    await mkdir(path.dirname(dir), { recursive: true });
    await takeLock(`${dir}.lock`);
    pg = new PGlite(dir);
  }
  const query: Query = async <T,>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows;
  return {
    query,
    // PGlite procesa una consulta a la vez, así que las transacciones ya quedan serializadas.
    tx: (fn) => pg.transaction((t) => fn(async <T,>(text: string, params: unknown[] = []) => (await t.query<T>(text, params)).rows)),
    close: () => pg.close(),
  };
}

/**
 * Base local servida por scripts/local.mjs (npm run dev / npm start): una sola instancia de
 * PGlite para todos los procesos de Next, con las consultas y transacciones de a una.
 */
function httpClient(url: string): Db {
  const { username: token, host } = new URL(url);
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

  async function call<T>(body: object): Promise<T> {
    const res = await fetch(`http://${host}/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    // Las fechas viajan como texto ISO: se vuelven a convertir en Date.
    const json = JSON.parse(await res.text(), (_k, v) => (typeof v === "string" && ISO_DATE.test(v) ? new Date(v) : v));
    if (!res.ok) throw Object.assign(new Error(json.error?.message ?? `Base local respondió ${res.status}`), { code: json.error?.code });
    return json.result as T;
  }

  const run = (tx?: string): Query => async <T,>(text: string, params: unknown[] = []) =>
    call<T[]>({ op: "query", sql: text, params, tx });

  return {
    query: run(),
    tx: async (fn) => {
      const id = await call<string>({ op: "begin" });
      try {
        const result = await fn(run(id));
        await call({ op: "commit", tx: id });
        return result;
      } catch (e) {
        await call({ op: "rollback", tx: id }).catch(() => {});
        throw e;
      }
    },
    close: async () => {},
  };
}

/** Candado por proceso: si otro proceso vivo tiene la base local abierta, no se abre una segunda vez. */
async function takeLock(file: string) {
  try {
    const pid = Number((await readFile(file, "utf8")).trim());
    if (pid && pid !== process.pid && isAlive(pid)) {
      throw new Error(
        `La base de datos local (.data/pglite) ya está abierta por otro proceso (PID ${pid}). ` +
          "Detén el otro servidor (npm run dev / npm start) antes de iniciar uno nuevo.",
      );
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await writeFile(file, String(process.pid));
  process.once("exit", () => {
    try {
      unlinkSync(file);
    } catch {}
  });
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0); // no mata: solo pregunta si el proceso existe
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function migrate(db: Db) {
  const schema = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  // Se separa por sentencias porque el driver `postgres` no acepta varias en una sola consulta con parámetros.
  for (const stmt of schema.split(/;\s*$/m).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s))) {
    await db.query(stmt);
  }
  const { seed } = await import("./seed");
  await seed(db.query);
}

const g = globalThis as unknown as { __aurumDb?: Promise<Db> };

function instance(): Promise<Db> {
  // Una sola conexión por proceso, también entre recargas del modo desarrollo.
  g.__aurumDb ??= connect().then(async (db) => {
    await migrate(db);
    return db;
  });
  return g.__aurumDb;
}

export const query: Query = async (text, params) => (await instance()).query(text, params);

export async function tx<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  return (await instance()).tx(fn);
}

/** Solo para pruebas: base nueva en memoria. */
export async function resetForTests() {
  if (g.__aurumDb) await (await g.__aurumDb).close();
  g.__aurumDb = connect("memory://").then(async (db) => {
    await migrate(db);
    return db;
  });
  await g.__aurumDb;
}
