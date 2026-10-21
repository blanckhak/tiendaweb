import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { rejectQuoteAdminAction, sendQuoteAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Loading, PageTitle, btn, btnDanger, btnGhost, dateTime, field } from "@/components/admin/ui";
import { soles } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth";
import { query } from "@/server/db";
import { getQuote, quoteStatusLabel, quoteTotals } from "@/server/quotes";

export default function QuotePage({ params }: PageProps<"/admin/cotizaciones/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Quote params={params} />
    </Suspense>
  );
}

async function Quote({ params }: Pick<PageProps<"/admin/cotizaciones/[code]">, "params">) {
  await requireAdmin();
  const { code } = await params;
  const quote = await getQuote(decodeURIComponent(code));
  if (!quote) notFound();
  const stock = await query<{ id: number; available: number }>(
    "select id, (stock - reserved)::int as available from product_variants where id = any($1::int[])",
    [quote.items.map((i) => i.variant_id)],
  );
  const available = new Map(stock.map((s) => [s.id, s.available]));
  const editable = quote.status === "solicitada" || quote.status === "enviada";
  const { subtotal, total } = quoteTotals(quote);

  return (
    <>
      <PageTitle aside={<Link href="/admin/cotizaciones" className={btnGhost}>← Cotizaciones</Link>}>
        <span className="mr-3">{quote.code}</span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium">{quoteStatusLabel[quote.status]}</span>
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title={editable ? "Precios de la cotización" : "Detalle"}>
          {quote.customer_note && (
            <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm">
              <b>Nota del cliente:</b> {quote.customer_note}
            </p>
          )}
          <ActionForm action={sendQuoteAction} className="space-y-4">
            <input type="hidden" name="quoteId" value={quote.id} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3">Perfume</th>
                    <th className="py-2 pr-3 text-right">Cant.</th>
                    <th className="py-2 pr-3 text-right">Disponible</th>
                    <th className="py-2 pr-3 text-right">Precio tienda</th>
                    <th className="py-2 text-right">Precio cotizado (S/)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {quote.items.map((i) => {
                    const av = available.get(i.variant_id) ?? 0;
                    return (
                      <tr key={i.id}>
                        <td className="py-2 pr-3">{i.brand} {i.name} {i.ml} ml</td>
                        <td className="py-2 pr-3 text-right">{i.qty}</td>
                        <td className={`py-2 pr-3 text-right ${av < i.qty ? "font-medium text-red-700" : "text-neutral-500"}`}>{av}</td>
                        <td className="py-2 pr-3 text-right text-neutral-500">{soles(i.list_price_cents / 100)}</td>
                        <td className="py-2 text-right">
                          <input
                            name={`price.${i.id}`}
                            type="number"
                            min="0"
                            step="0.1"
                            required
                            disabled={!editable}
                            defaultValue={(i.unit_price_cents ?? i.list_price_cents) / 100}
                            className={`${field} ml-auto w-28 text-right`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {quote.items.some((i) => (available.get(i.variant_id) ?? 0) < i.qty) && (
              <p className="text-xs text-red-700">
                Hay perfumes con menos stock que lo pedido: repón stock antes de que el cliente acepte, o el pedido no se podrá crear.
              </p>
            )}
            {editable && (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  Descuento total (S/)
                  <input name="discount" type="number" min="0" step="0.1" defaultValue={quote.discount_cents / 100} className={`${field} mt-1`} />
                </label>
                <label className="text-sm">
                  Envío (S/, vacío = por confirmar)
                  <input name="shipping" type="number" min="0" step="0.5" defaultValue={quote.shipping_cents === null ? "" : quote.shipping_cents / 100} className={`${field} mt-1`} />
                </label>
                <label className="text-sm">
                  Válida por (días)
                  <input name="validDays" type="number" min="1" max="60" defaultValue={7} className={`${field} mt-1`} />
                </label>
                <label className="text-sm sm:col-span-3">
                  Nota para el cliente (opcional)
                  <textarea name="note" rows={2} defaultValue={quote.admin_note} placeholder="Ej.: Incluye caja de regalo. Entrega en 48 h en Lima." className={`${field} mt-1`} />
                </label>
              </div>
            )}
            {editable && (
              <button className={btn}>{quote.status === "enviada" ? "Actualizar y reenviar por WhatsApp" : "Enviar cotización por WhatsApp"}</button>
            )}
          </ActionForm>
          {quote.status !== "solicitada" && (
            <p className="mt-4 text-sm text-neutral-600">
              Subtotal {soles(subtotal / 100)} · Descuento {soles(quote.discount_cents / 100)} · Envío{" "}
              {quote.shipping_cents === null ? "por confirmar" : soles(quote.shipping_cents / 100)} · <b>Total {soles(total / 100)}</b>
              {quote.valid_until && <> · válida hasta {dateTime(quote.valid_until)}</>}
            </p>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Cliente">
            <p className="font-medium">{quote.first_name} {quote.last_name}</p>
            <p className="text-sm text-neutral-600">{displayPhone(quote.phone)}</p>
            <Link href={`/admin/chats/${quote.customer_id}`} className={`${btnGhost} mt-3`}>Ver chat</Link>
            <p className="mt-3 text-xs text-neutral-500">Pedida {dateTime(quote.created_at)}</p>
          </Card>
          {quote.order_code && (
            <Card title="Pedido">
              <Link href={`/admin/pedidos/${quote.order_code}`} className="font-medium underline">{quote.order_code}</Link>
            </Card>
          )}
          {editable && (
            <Card>
              <ActionForm action={rejectQuoteAdminAction} confirm="¿Rechazar esta cotización?">
                <input type="hidden" name="quoteId" value={quote.id} />
                <button className={btnDanger}>Rechazar cotización</button>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
