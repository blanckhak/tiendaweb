import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfileAction } from "@/app/cuenta-actions";
import { AcceptQuote } from "@/components/cuenta/accept-quote";
import { soles } from "@/lib/format";
import { currentCustomerId } from "@/server/customer-auth";
import { getQuote, quoteStatusLabel, quoteTotals } from "@/server/quotes";

export const metadata: Metadata = { title: "Cotización", robots: { index: false } };

export default function QuotePage({ params }: PageProps<"/cuenta/cotizaciones/[code]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <QuoteDetail params={params} />
      </Suspense>
    </div>
  );
}

async function QuoteDetail({ params }: Pick<PageProps<"/cuenta/cotizaciones/[code]">, "params">) {
  const { code } = await params;
  const id = await currentCustomerId();
  if (!id) redirect(`/cuenta/ingresar?next=${encodeURIComponent(`/cuenta/cotizaciones/${code}`)}`);
  const quote = await getQuote(decodeURIComponent(code).toUpperCase());
  if (!quote || quote.customer_id !== id) notFound(); // nunca muestra cotizaciones de otro cliente
  const profile = (await getProfileAction())!;
  const quoted = quote.status !== "solicitada";
  const { subtotal, total } = quoteTotals(quote);

  return (
    <>
      <Link href="/cuenta" className="text-sm text-neutral-500 hover:underline">← Mi cuenta</Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">{quote.code}</h1>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{quoteStatusLabel[quote.status]}</span>
      </div>
      {quote.customer_note && <p className="mt-3 text-sm text-neutral-600">Tu nota: “{quote.customer_note}”</p>}

      <table className="mt-8 w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="py-2">Perfume</th>
            <th className="py-2 text-right">Cant.</th>
            <th className="py-2 text-right">Precio</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {quote.items.map((i) => {
            const unit = i.unit_price_cents ?? i.list_price_cents;
            const better = quoted && i.unit_price_cents !== null && i.unit_price_cents < i.list_price_cents;
            return (
              <tr key={i.id}>
                <td className="py-3">{i.brand} {i.name} {i.ml} ml</td>
                <td className="py-3 text-right">{i.qty}</td>
                <td className="py-3 text-right">
                  {quoted ? soles(unit / 100) : <span className="text-neutral-400">por cotizar</span>}
                  {better && <span className="block text-xs text-neutral-400 line-through">{soles(i.list_price_cents / 100)}</span>}
                </td>
                <td className="py-3 text-right">{quoted ? soles((unit * i.qty) / 100) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {quoted ? (
        <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-neutral-500">Subtotal</dt><dd>{soles(subtotal / 100)}</dd></div>
          {quote.discount_cents > 0 && <div className="flex justify-between text-emerald-700"><dt>Descuento</dt><dd>− {soles(quote.discount_cents / 100)}</dd></div>}
          <div className="flex justify-between"><dt className="text-neutral-500">Envío</dt><dd>{quote.shipping_cents === null ? "por confirmar" : soles(quote.shipping_cents / 100)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{soles(total / 100)}</dd></div>
          {quote.valid_until && (
            <p className="pt-2 text-xs text-neutral-500">
              Válida hasta el {new Date(quote.valid_until).toLocaleDateString("es-PE", { day: "numeric", month: "long", timeZone: "America/Lima" })}
            </p>
          )}
        </dl>
      ) : (
        <p className="mt-6 bg-mist p-4 text-sm text-neutral-600">
          Estamos preparando tus precios. Te avisaremos por WhatsApp apenas esté lista.
        </p>
      )}

      {quote.admin_note && <p className="mt-6 border-l-2 border-ink pl-4 text-sm">{quote.admin_note}</p>}

      <div className="mt-10">
        {quote.status === "enviada" && <AcceptQuote code={quote.code} profile={profile} />}
        {quote.status === "aceptada" && quote.order_code && (
          <p className="text-sm">
            Convertida en el pedido <b>{quote.order_code}</b>. Puedes ver su estado en <Link href="/cuenta" className="underline">Mi cuenta</Link>.
          </p>
        )}
        {quote.status === "vencida" && (
          <p className="text-sm text-neutral-600">
            Esta cotización venció. <Link href="/cotizar" className="underline">Pide una nueva</Link> y te respondemos por WhatsApp.
          </p>
        )}
      </div>
    </>
  );
}
