import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/cuenta/auth-shell";
import { LoginOptions } from "@/components/cuenta/login-options";
import { currentCustomerId } from "@/server/customer-auth";
import { googleEnabled, safeNext } from "@/server/google";

export const metadata: Metadata = { title: "Entrar o crear cuenta", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/cuenta/ingresar">) {
  return (
    <AuthShell
      kicker="Mi cuenta"
      title="Bienvenido de vuelta"
      subtitle="Inicia sesión o crea tu cuenta en segundos. Si es tu primera vez con WhatsApp o Google, la cuenta se crea sola."
    >
      <Suspense fallback={<div className="h-80 animate-pulse bg-mist" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/cuenta/ingresar">, "searchParams">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentCustomerId()) redirect(next);
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : null;
  return (
    <>
      {error && <p className="mb-6 bg-amber-50 p-3 text-center text-sm text-amber-800">{error}</p>}
      <LoginOptions next={next} google={googleEnabled()} />
    </>
  );
}
