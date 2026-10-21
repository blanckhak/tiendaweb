import { NextResponse, type NextRequest } from "next/server";
import { CUSTOMER_COOKIE, SESSION_MS, customerFromGoogle, sessionCookieOptions, sessionValue } from "@/server/customer-auth";
import { exchangeCode, OAUTH_COOKIE, readPending } from "@/server/google";

/** Google vuelve aquí con ?code&state. Se valida el state, se canjea el código y se abre la sesión. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pending = readPending(request.cookies.get(OAUTH_COOKIE)?.value);
  const fail = (motivo: string) => {
    const res = NextResponse.redirect(new URL(`/cuenta/ingresar?error=${encodeURIComponent(motivo)}`, url));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
    return res;
  };

  if (url.searchParams.get("error")) return fail("Cancelaste el ingreso con Google.");
  const code = url.searchParams.get("code");
  if (!pending || !code || url.searchParams.get("state") !== pending.state) return fail("El ingreso con Google expiró. Inténtalo de nuevo.");

  try {
    const profile = await exchangeCode(code, pending.verifier);
    const customer = await customerFromGoogle(profile);
    // Sin WhatsApp vinculado todavía: se pide vincularlo antes de seguir.
    const dest = customer.hasPhone ? pending.next : `/cuenta/vincular?next=${encodeURIComponent(pending.next)}`;
    const res = NextResponse.redirect(new URL(dest, url));
    const exp = Date.now() + SESSION_MS;
    res.cookies.set(CUSTOMER_COOKIE, sessionValue(customer.id, exp), sessionCookieOptions(exp));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
    return res;
  } catch (e) {
    console.error("[google]", e);
    return fail("No pudimos entrar con Google. Inténtalo de nuevo o entra con WhatsApp.");
  }
}
