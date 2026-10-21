import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { query, tx, type Query } from "./db";

/**
 * Cuentas de clientes sin contraseña: el cliente demuestra que el número es suyo
 * enviando un código por WhatsApp a la tienda.
 *
 * 1. startLogin(): crea un código corto ("ACCESO 7KQ2MX") y un token largo que se guarda
 *    solo en una cookie httpOnly del navegador (en la base queda su hash).
 * 2. El cliente envía el código por WhatsApp → verifyLoginCode() lo une a su teléfono.
 * 3. El navegador consulta finishLogin(): si el código ya se verificó, abre la sesión.
 */
export const CUSTOMER_COOKIE = "aurum_cliente";
export const LOGIN_COOKIE = "aurum_ingreso";
const LOGIN_MINUTES = 10;
const SESSION_DAYS = 60;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para no confundir
export const LOGIN_CODE = /\bACCESO\s+([A-Z2-9]{6})\b/i;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres).");
  return "dev-only-secret-change-me-dev-only-secret";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`cliente:${payload}`).digest("base64url");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

/**
 * Paso 1: devuelve el código que el cliente debe enviar por WhatsApp.
 * Con `linkTo` (cuenta abierta con Google y sin teléfono) el WhatsApp verificado se une a esa cuenta.
 */
export async function startLogin(linkTo?: number) {
  const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + LOGIN_MINUTES * 60 * 1000);
  await query("delete from login_requests where expires_at < now() - interval '1 day'");
  await query("insert into login_requests (code, token_hash, expires_at, link_customer_id) values ($1, $2, $3, $4)", [
    code,
    hash(token),
    expires,
    linkTo ?? null,
  ]);
  (await cookies()).set(LOGIN_COOKIE, token, cookieOptions(expires));
  return { code, expires };
}

/** Paso 2 (lo llama el bot): el mensaje "ACCESO XXXXXX" llegó desde este cliente. */
export async function verifyLoginCode(code: string, customerId: number) {
  return tx(async (q) => {
    const [req] = await q<{ id: number; link_customer_id: number | null }>(
      `select id, link_customer_id from login_requests
       where code = $1 and verified_at is null and used_at is null and expires_at > now() for update`,
      [code.toUpperCase()],
    );
    if (!req) return false;
    // Vincular: la cuenta de Google se une al cliente dueño de este WhatsApp.
    if (req.link_customer_id && req.link_customer_id !== customerId) await mergeCustomers(q, req.link_customer_id, customerId);
    await q("update login_requests set customer_id = $2, verified_at = now(), link_customer_id = null where id = $1", [req.id, customerId]);
    return true;
  });
}

/**
 * Une la cuenta `from` (creada con Google, sin teléfono) dentro de `into` (dueña del WhatsApp):
 * pasa el acceso con Google, completa datos vacíos y mueve pedidos y cotizaciones. Luego borra `from`.
 */
export async function mergeCustomers(q: Query, from: number, into: number) {
  const [src] = await q<{
    phone: string | null;
    google_sub: string | null;
    email: string | null;
    first_name: string;
    last_name: string;
    login_email: string | null;
    password_hash: string | null;
  }>("select phone, google_sub, email, first_name, last_name, login_email, password_hash from customers where id = $1 for update", [from]);
  if (!src) return;
  if (src.phone) throw new Error("La cuenta a vincular ya tiene un WhatsApp.");
  // google_sub y login_email son únicos: se liberan antes de pasarlos a la otra cuenta.
  await q("update customers set google_sub = null, login_email = null where id = $1", [from]);
  await q(
    `update customers set google_sub = coalesce(google_sub, $2), email = coalesce(email, $3),
       first_name = case when first_name = '' then $4 else first_name end,
       last_name = case when last_name = '' then $5 else last_name end,
       password_hash = case when login_email is null and $6::text is not null then $7 else password_hash end,
       login_email = coalesce(login_email, $6)
     where id = $1`,
    [into, src.google_sub, src.email, src.first_name, src.last_name, src.login_email, src.password_hash],
  );
  for (const table of ["orders", "quotes", "wa_messages", "automation_jobs", "reviews"])
    await q(`update ${table} set customer_id = $2 where customer_id = $1`, [from, into]);
  await q(
    `delete from stock_alerts a using stock_alerts b
     where a.customer_id = $1 and b.customer_id = $2 and a.variant_id = b.variant_id`,
    [from, into],
  );
  await q("update stock_alerts set customer_id = $2 where customer_id = $1", [from, into]);
  await q("update login_requests set customer_id = $2 where customer_id = $1", [from, into]);
  await q("update login_requests set link_customer_id = null where link_customer_id = $1", [from]);
  await q("delete from customers where id = $1", [from]);
}

/** Abre la sesión del cliente (cookie firmada). */
export async function setCustomerSession(customerId: number) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  (await cookies()).set(CUSTOMER_COOKIE, sessionValue(customerId, exp), cookieOptions(new Date(exp)));
}

export const sessionValue = (customerId: number, exp: number) => `${customerId}.${exp}.${sign(`${customerId}.${exp}`)}`;
export const sessionCookieOptions = (exp: number) => cookieOptions(new Date(exp));
export const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Datos que entrega Google al iniciar sesión. */
export type GoogleProfile = { sub: string; email?: string; given_name?: string; family_name?: string };

/** Busca o crea la cuenta del cliente que entró con Google. Nunca une cuentas solo por el correo. */
export async function customerFromGoogle(g: GoogleProfile): Promise<{ id: number; hasPhone: boolean }> {
  const [found] = await query<{ id: number; phone: string | null }>("select id, phone from customers where google_sub = $1", [g.sub]);
  if (found) return { id: found.id, hasPhone: !!found.phone };
  const [created] = await query<{ id: number }>(
    "insert into customers (phone, google_sub, email, first_name, last_name) values (null, $1, $2, $3, $4) returning id",
    [g.sub, g.email ?? null, g.given_name ?? "", g.family_name ?? ""],
  );
  return { id: created.id, hasPhone: false };
}

/** Paso 3: si el código de este navegador ya fue verificado, abre la sesión. */
export async function finishLogin(): Promise<"ok" | "pendiente" | "vencido"> {
  const jar = await cookies();
  const token = jar.get(LOGIN_COOKIE)?.value;
  if (!token) return "vencido";
  const [req] = await query<{ id: number; customer_id: number | null; expires_at: Date; used_at: Date | null }>(
    "select id, customer_id, expires_at, used_at from login_requests where token_hash = $1",
    [hash(token)],
  );
  if (!req || req.used_at || new Date(req.expires_at).getTime() < Date.now()) return "vencido";
  if (!req.customer_id) return "pendiente";
  // Un solo uso: se marca antes de abrir la sesión.
  const used = await query("update login_requests set used_at = now() where id = $1 and used_at is null returning id", [req.id]);
  if (!used.length) return "vencido";
  jar.delete(LOGIN_COOKIE);
  await setCustomerSession(req.customer_id);
  return "ok";
}

export function parseSession(value: string | undefined): number | null {
  if (!value) return null;
  const [id, exp, sig] = value.split(".");
  if (!/^\d+$/.test(id ?? "") || !/^\d+$/.test(exp ?? "") || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  return safeEqual(sig, sign(`${id}.${exp}`)) ? Number(id) : null;
}

/** Id del cliente con sesión abierta, o null. */
export async function currentCustomerId() {
  await connection(); // depende de la cookie: siempre en cada visita
  return parseSession((await cookies()).get(CUSTOMER_COOKIE)?.value);
}

export async function logoutCustomer() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}
