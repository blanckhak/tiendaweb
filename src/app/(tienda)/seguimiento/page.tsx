"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { trackOrderAction } from "@/app/actions";
import { WhatsAppIcon } from "@/components/icons";
import { OrderProgress } from "@/components/order-progress";
import { useStore } from "@/components/store-provider";
import { waLink } from "@/lib/wa-link";
import { soles } from "@/lib/format";
import { statusLabel, statusTone } from "@/lib/order-status";
import type { TrackedOrder } from "@/server/tracking";

const input = "w-full border border-line bg-white px-3 py-3 text-sm outline-none focus:border-ink";
const date = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" });

const help: Partial<Record<TrackedOrder["status"], string>> = {
  pendiente_pago: "Estamos esperando tu pago. Envía la captura del comprobante por WhatsApp.",
  pago_en_revision: "Recibimos tu comprobante y lo estamos validando.",
  pagado: "¡Pago confirmado! Estamos preparando tu pedido.",
  preparando: "Tu pedido se está empacando.",
  despachado: "Tu pedido va en camino.",
  entregado: "Tu pedido fue entregado. ¡Gracias por tu compra!",
  cancelado: "Este pedido fue cancelado.",
  vencido: "Este pedido venció porque no recibimos el pago.",
};

export default function TrackingPage() {
  const { whatsapp } = useStore();
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Sin necesidad de cuenta</p>
      <h1 className="mt-2 text-4xl">Sigue tu pedido</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Ingresa el código de tu pedido (lo recibiste por WhatsApp, por ejemplo <b>AUR-1001</b>) y los 4 últimos dígitos del
        WhatsApp con el que compraste.
      </p>

      <form
        className="mt-8 grid gap-3 border border-line bg-white p-6 sm:grid-cols-[1fr_160px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const res = await trackOrderAction(f.get("code")?.toString() ?? "", f.get("last4")?.toString() ?? "");
            if (res.ok) setOrder(res.data);
            else {
              setOrder(null);
              setError(res.error);
            }
          });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">Código del pedido</span>
          <input name="code" required placeholder="AUR-1001" autoCapitalize="characters" className={`${input} uppercase`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">Últimos 4 dígitos</span>
          <input name="last4" required inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="4321" className={input} />
        </label>
        <button disabled={pending} className="self-end bg-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {error && <p className="mt-4 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>}

      {order && (
        <section className="animate-fade-up mt-8 border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold">{order.code}</p>
              <p className="text-xs text-neutral-500">Pedido del {date(order.created_at)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone[order.status]}`}>{statusLabel[order.status]}</span>
          </div>
          <OrderProgress status={order.status} />
          <p className="mt-6 text-sm">{help[order.status]}</p>

          {order.tracking_number && (
            <div className="mt-4 bg-mist p-4 text-sm">
              Agencia: <b>{order.courier}</b> · Número de guía: <b>{order.tracking_number}</b>
            </div>
          )}

          <ul className="mt-6 divide-y divide-line border-y border-line text-sm">
            {order.items.map((i, n) => (
              <li key={n} className="py-2">{i.qty} × {i.brand} {i.name} {i.ml} ml</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            Total <b>{soles(order.total_cents / 100)}</b>
            {order.shipping_cents === 0 ? <span className="text-emerald-700"> · envío gratis</span> : order.shipping_cents === null && order.delivery_method === "domicilio" ? <span className="text-neutral-500"> + envío</span> : null}
            {order.delivery_method === "tienda" ? " · Recojo en tienda" : order.distrito ? ` · Envío a ${order.distrito}` : ""}
          </p>

          <a
            href={waLink(whatsapp, `Hola, tengo una consulta sobre mi pedido *${order.code}*`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 bg-[#25d366] px-5 py-3 text-sm font-semibold text-white"
          >
            <WhatsAppIcon className="size-5" /> Consultar por WhatsApp
          </a>
        </section>
      )}

      <p className="mt-10 text-center text-sm text-neutral-500">
        ¿Tienes cuenta? En <Link href="/cuenta" className="underline">Mi cuenta</Link> ves todos tus pedidos sin escribir nada.
      </p>
    </div>
  );
}
