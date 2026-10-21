import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/cuenta/auth-shell";
import { WhatsAppLogin } from "@/components/cuenta/whatsapp-login";
import { currentCustomerId } from "@/server/customer-auth";
import { query } from "@/server/db";
import { safeNext } from "@/server/google";

export const metadata: Metadata = { title: "Vincular WhatsApp", robots: { index: false } };

/** Cuenta creada con Google o correo: vincula su WhatsApp una vez (pedidos, pagos y avisos van por ahí). */
export default function LinkPage({ searchParams }: PageProps<"/cuenta/vincular">) {
  return (
    <AuthShell
      kicker="Último paso"
      title="Vincula tu WhatsApp"
      subtitle="Por WhatsApp te confirmamos el pedido, recibes los datos de pago y el número de guía. Solo se hace una vez."
    >
      <Suspense fallback={<div className="h-40 animate-pulse bg-mist" />}>
        <Link searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Link({ searchParams }: Pick<PageProps<"/cuenta/vincular">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  const id = await currentCustomerId();
  if (!id) redirect(`/cuenta/ingresar?next=${encodeURIComponent(next)}`);
  const [c] = await query<{ phone: string | null }>("select phone from customers where id = $1", [id]);
  if (c?.phone) redirect(next); // ya está vinculado
  return (
    <div className="py-4">
      <ol className="mb-8 space-y-3 text-sm text-neutral-600">
        <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs text-white">1</span>Toca el botón y se abre WhatsApp con un código.</li>
        <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs text-white">2</span>Envía el mensaje tal cual.</li>
        <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs text-white">3</span>Vuelve aquí: la página continúa sola.</li>
      </ol>
      <WhatsAppLogin next={next} link />
    </div>
  );
}
