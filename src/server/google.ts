import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { store } from "@/lib/config";
import type { GoogleProfile } from "./customer-auth";

/**
 * "Continuar con Google" (OAuth 2.0 / OpenID Connect, flujo de código con PKCE).
 * Requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET; sin ellos el botón no se muestra.
 * URI de redirección a registrar en Google Cloud: <NEXT_PUBLIC_SITE_URL>/api/auth/google/callback
 */
export const OAUTH_COOKIE = "aurum_google";

export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const redirectUri = () => `${store.siteUrl}/api/auth/google/callback`;

/** Solo rutas internas: evita redirigir a otro sitio después del ingreso. */
export const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/cuenta");

export function authorizationRequest(next: string) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  // state, verificador PKCE y destino viajan en una cookie httpOnly de corta vida.
  return { url: url.toString(), cookie: JSON.stringify({ state, verifier, next: safeNext(next) }) };
}

type Pending = { state: string; verifier: string; next: string };

export function readPending(cookie: string | undefined): Pending | null {
  try {
    const p = JSON.parse(cookie ?? "") as Pending;
    return typeof p.state === "string" && typeof p.verifier === "string" ? { ...p, next: safeNext(p.next) } : null;
  } catch {
    return null;
  }
}

/** Canjea el código por el id_token y devuelve los datos del usuario ya validados. */
export async function exchangeCode(code: string, verifier: string): Promise<GoogleProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const json = (await res.json()) as { id_token?: string; error?: string };
  if (!res.ok || !json.id_token) throw new Error(`Google rechazó el ingreso: ${json.error ?? res.status}`);
  return validateIdToken(json.id_token);
}

/**
 * El id_token llega directo del servidor de Google por HTTPS a cambio de nuestro client_secret,
 * así que (OpenID Connect Core §3.1.3.7) basta validar emisor, destinatario y vigencia.
 */
export function validateIdToken(idToken: string, clientId = process.env.GOOGLE_CLIENT_ID): GoogleProfile {
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") throw new Error("Emisor inválido");
  if (payload.aud !== clientId) throw new Error("Token para otra aplicación");
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) throw new Error("Token vencido");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Token sin usuario");
  const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : undefined);
  return {
    sub: payload.sub,
    email: payload.email_verified === true ? str("email") : undefined,
    given_name: str("given_name"),
    family_name: str("family_name"),
  };
}
