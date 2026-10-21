import { NextResponse } from "next/server";
import { authorizationRequest, googleEnabled, OAUTH_COOKIE } from "@/server/google";

/** Inicia "Continuar con Google": redirige a la pantalla de Google. */
export async function GET(request: Request) {
  if (!googleEnabled()) return new Response("Ingreso con Google no configurado", { status: 404 });
  const next = new URL(request.url).searchParams.get("next") ?? "/cuenta";
  const { url, cookie } = authorizationRequest(next);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // debe viajar en la redirección de vuelta desde Google
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return res;
}
