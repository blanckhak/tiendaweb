import { NextResponse, type NextRequest } from "next/server";

// Revisión rápida: sin cookie de sesión, el panel redirige al login.
// La verificación real de la firma se hace en cada página y acción (requireAdmin).
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has("aurum_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
