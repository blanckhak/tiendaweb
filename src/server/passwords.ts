import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { query } from "./db";

/**
 * Cuentas con correo y contraseña. Las contraseñas se guardan con scrypt (sal aleatoria),
 * nunca en texto. Tras 10 intentos fallidos en 15 minutos el correo queda bloqueado un rato.
 */
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;
export const MAX_FAILURES = 10;
const WINDOW_MIN = 15;

export class AuthError extends Error {}

export const emailSchema = z.email("Correo inválido").max(120).transform((e) => e.trim().toLowerCase());
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña es demasiado larga");

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Hash fijo para comparar aunque el correo no exista: así el tiempo de respuesta no revela qué correos hay.
let dummyHash: Promise<string> | null = null;

/** Devuelve el id del cliente si correo y contraseña son correctos. */
export async function loginWithPassword(emailInput: string, password: string): Promise<{ id: number; hasPhone: boolean }> {
  const email = emailSchema.parse(emailInput);
  const [{ failures }] = await query<{ failures: number }>(
    `select count(*)::int as failures from password_failures
     where login_email = $1 and created_at > now() - make_interval(mins => $2)`,
    [email, WINDOW_MIN],
  );
  if (failures >= MAX_FAILURES) throw new AuthError(`Demasiados intentos. Espera ${WINDOW_MIN} minutos o entra con WhatsApp.`);

  const [c] = await query<{ id: number; phone: string | null; password_hash: string | null }>(
    "select id, phone, password_hash from customers where login_email = $1",
    [email],
  );
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  const ok = await verifyPassword(password, c?.password_hash ?? (await dummyHash));
  if (!c || !c.password_hash || !ok) {
    await query("insert into password_failures (login_email) values ($1)", [email]);
    await query("delete from password_failures where created_at < now() - interval '1 day'");
    throw new AuthError("Correo o contraseña incorrectos.");
  }
  await query("delete from password_failures where login_email = $1", [email]);
  return { id: c.id, hasPhone: !!c.phone };
}

/** Crea una cuenta nueva con correo y contraseña (todavía sin WhatsApp). */
export async function registerWithPassword(input: { firstName: string; email: string; password: string }) {
  const firstName = z.string().trim().min(1, "Ingresa tu nombre").max(60).parse(input.firstName);
  const email = emailSchema.parse(input.email);
  const hash = await hashPassword(passwordSchema.parse(input.password));
  const rows = await query<{ id: number }>(
    `insert into customers (phone, first_name, email, login_email, password_hash) values (null, $1, $2, $2, $3)
     on conflict (login_email) do nothing returning id`,
    [firstName, email, hash],
  );
  if (!rows.length) throw new AuthError("Ya existe una cuenta con ese correo. Inicia sesión o entra con WhatsApp.");
  return rows[0].id;
}

/** Pone o cambia el correo y la contraseña de una cuenta con sesión abierta. */
export async function setPassword(customerId: number, emailInput: string, password: string) {
  const email = emailSchema.parse(emailInput);
  const hash = await hashPassword(passwordSchema.parse(password));
  const [taken] = await query<{ id: number }>("select id from customers where login_email = $1 and id <> $2", [email, customerId]);
  if (taken) throw new AuthError("Ese correo ya lo usa otra cuenta.");
  await query("update customers set login_email = $2, password_hash = $3, email = coalesce(email, $2) where id = $1", [
    customerId,
    email,
    hash,
  ]);
  await query("delete from password_failures where login_email = $1", [email]);
}
