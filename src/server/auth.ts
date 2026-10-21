import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

/**
 * Sesión del panel: una cookie httpOnly firmada con HMAC ("<expira>.<firma>").
 * El correo está en ADMIN_EMAIL y la contraseña en ADMIN_PASSWORD. Sin ADMIN_EMAIL basta la contraseña.
 * En desarrollo, si falta la contraseña, se usa "admin123" para poder probar;
 * en producción es obligatoria (sin ella nadie puede entrar).
 */
export const SESSION_COOKIE = "aurum_admin";
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Falta SESSION_SECRET (mínimo 32 caracteres).");
  return "dev-only-secret-change-me-dev-only-secret";
}

function adminPassword() {
  const p = process.env.ADMIN_PASSWORD;
  if (p) return p;
  return process.env.NODE_ENV === "production" ? null : "admin123";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string) {
  const p = adminPassword();
  if (!p) return false;
  // Se comparan hashes para que el tiempo no revele la longitud de la contraseña.
  return safeEqual(sign(`pw:${input}`), sign(`pw:${p}`));
}

/** El correo no distingue mayúsculas ni espacios. Si no hay ADMIN_EMAIL, cualquiera vale. */
export function checkEmail(input: string) {
  const e = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return !e || input.trim().toLowerCase() === e;
}

export const adminEmailRequired = () => !!process.env.ADMIN_EMAIL?.trim();

export function newSessionToken() {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return { token: `${exp}.${sign(String(exp))}`, expires: new Date(exp) };
}

export function isValidToken(token: string | undefined) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

export async function isAdmin() {
  await connection(); // la sesión se valida en cada visita, nunca en el HTML pregenerado
  return isValidToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Úsalo al inicio de cada página y acción del panel. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
