import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Dos espacios:
 *  - "public": fotos de productos, servidas por /media/<key>
 *  - "private": comprobantes de pago, solo visibles en el panel admin
 *
 * Con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY usa Supabase Storage
 * (buckets "public" y "private"); si no, guarda en .data/uploads.
 */
export type Space = "public" | "private";

const supabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
};

const localDir = (space: Space) => path.join(process.cwd(), ".data", "uploads", space);

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const ALLOWED_TYPES = Object.keys(EXT);

/** Guarda el archivo y devuelve su clave ("public/xxxx.jpg"). */
export async function putFile(space: Space, data: Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType];
  if (!ext) throw new Error(`Tipo de archivo no permitido: ${contentType}`);
  const name = `${randomUUID()}.${ext}`;
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${space}/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sb.key}`, "Content-Type": contentType, "x-upsert": "false" },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Supabase Storage respondió ${res.status}: ${await res.text()}`);
  } else {
    await mkdir(localDir(space), { recursive: true });
    await writeFile(path.join(localDir(space), name), data);
  }
  return `${space}/${name}`;
}

/** Lee un archivo por su clave. Devuelve null si no existe o la clave es inválida. */
export async function getFile(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  const m = /^(public|private)\/([0-9a-f-]{36}\.(jpg|png|webp|pdf))$/.exec(key);
  if (!m) return null; // evita rutas como ../../
  const [, space, name, ext] = m;
  const contentType = Object.entries(EXT).find(([, e]) => e === ext)![0];
  const sb = supabase();
  if (sb) {
    const res = await fetch(`${sb.url}/storage/v1/object/${space}/${name}`, {
      headers: { Authorization: `Bearer ${sb.key}` },
    });
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), contentType };
  }
  try {
    return { data: await readFile(path.join(localDir(space as Space), name)), contentType };
  } catch {
    return null;
  }
}

/** URL para mostrar una foto pública en la tienda. */
export function publicUrl(key: string) {
  const sb = supabase();
  if (sb && key.startsWith("public/")) return `${sb.url}/storage/v1/object/public/${key}`;
  return `/media/${key.replace(/^public\//, "")}`;
}
