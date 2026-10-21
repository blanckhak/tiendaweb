/* eslint-disable @next/next/no-img-element -- comprobantes privados servidos por /admin/archivo */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { orderAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Loading, PageTitle, StatusBadge, btn, btnDanger, btnGhost, dateTime, field } from "@/components/admin/ui";
import { soles } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth";
import { getOrder } from "@/server/orders";

export default function OrderPage({ params }: PageProps<"/admin/pedidos/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Order params={params} />
    </Suspense>
  );
}

function Op({ orderId, op, label, style = btn, confirm, children }: { orderId: number; op: string; label: string; style?: string; confirm?: string; children?: React.ReactNode }) {
  return (
    <ActionForm action={orderAction} confirm={confirm} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="op" value={op} />
      {children}
      <button className={style}>{label}</button>
    </ActionForm>
  );
}

async function Order({ params }: Pick<PageProps<"/admin/pedidos/[code]">, "params">) {
  await requireAdmin();
  const { code } = await params;
  const o = await getOrder(decodeURIComponent(code));
  if (!o) notFound();

  const s = o.status;
  const canCancel = ["pendiente_pago", "pago_en_revision", "pagado", "preparando"].includes(s);

  return (
    <>
      <PageTitle aside={<Link href="/admin/pedidos" className={btnGhost}>← Pedidos</Link>}>
        <span className="mr-3">{o.code}</span>
        <StatusBadge status={s} />
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Productos">
            <ul className="divide-y divide-line text-sm">
              {o.items.map((i, n) => (
                <li key={n} className="flex justify-between py-2">
                  <span>{i.qty} × {i.brand} {i.name} {i.ml} ml</span>
                  <span>{soles((i.qty * i.price_cents) / 100)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Subtotal</dt><dd>{soles(o.subtotal_cents / 100)}</dd></div>
              {o.discount_cents > 0 && (
                <div className="flex justify-between text-emerald-700"><dt>Descuento (cotización)</dt><dd>− {soles(o.discount_cents / 100)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-neutral-500">Envío</dt><dd>{o.shipping_cents === null ? <span className="text-amber-700">Por confirmar</span> : soles(o.shipping_cents / 100)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{soles(o.total_cents / 100)}</dd></div>
            </dl>
          </Card>

          <Card title="Comprobantes de pago">
            {o.payments.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Aún no llega ningún comprobante. Cuando el cliente envíe la captura por WhatsApp aparecerá aquí.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {o.payments.map((p) => (
                  <div key={p.id} className="rounded-md border border-line p-3 text-sm">
                    {p.receipt_key?.endsWith(".pdf") ? (
                      <a href={`/admin/archivo/${p.receipt_key}`} target="_blank" className="underline">Ver PDF</a>
                    ) : p.receipt_key ? (
                      <a href={`/admin/archivo/${p.receipt_key}`} target="_blank">
                        <img src={`/admin/archivo/${p.receipt_key}`} alt="Comprobante" className="max-h-80 w-full rounded object-contain" />
                      </a>
                    ) : null}
                    <p className="mt-2 text-xs text-neutral-500">
                      {p.method.toUpperCase()} · {dateTime(p.created_at)} · <b>{p.status.replace("_", " ")}</b>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Entrega">
            {o.delivery_method === "tienda" ? (
              <p className="text-sm">Recojo en tienda</p>
            ) : (
              <p className="text-sm">
                {o.address}, {o.distrito}, {o.provincia}, {o.departamento}
                {o.reference && <span className="block text-neutral-500">Ref.: {o.reference}</span>}
              </p>
            )}
            {o.tracking_number && (
              <p className="mt-2 text-sm">Agencia: <b>{o.courier}</b> · Guía: <b>{o.tracking_number}</b></p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Cliente">
            <p className="font-medium">{o.first_name} {o.last_name}</p>
            <p className="text-sm text-neutral-600">{displayPhone(o.phone)}</p>
            {o.document && <p className="text-sm text-neutral-600">Doc.: {o.document}</p>}
            {o.email && <p className="text-sm text-neutral-600">{o.email}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/admin/chats/${o.customer_id}`} className={btnGhost}>Ver chat</Link>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Pago: {o.payment_method === "plin" ? "Plin" : "Yape"} · Creado {dateTime(o.created_at)}
              {o.reserved_until && s === "pendiente_pago" && <> · Reserva hasta {dateTime(o.reserved_until)}</>}
            </p>
          </Card>

          <Card title="Acciones">
            <div className="space-y-5">
              {["pendiente_pago", "pago_en_revision", "pagado", "preparando"].includes(s) && (
                <Op orderId={o.id} op="envio" label="Guardar costo de envío" style={btnGhost}>
                  <label className="block text-sm">
                    Costo de envío (S/)
                    <input name="shipping" type="number" min="0" step="0.5" defaultValue={o.shipping_cents === null ? "" : o.shipping_cents / 100} required className={`${field} mt-1`} />
                  </label>
                </Op>
              )}

              {(s === "pago_en_revision" || s === "pendiente_pago") && (
                <div className="flex flex-wrap gap-2">
                  <Op orderId={o.id} op="aprobar" label="✓ Aprobar pago" confirm="¿Confirmas que el pago llegó a tu cuenta? Se avisará al cliente." />
                  {s === "pago_en_revision" && (
                    <Op orderId={o.id} op="rechazar" label="Rechazar comprobante" style={btnDanger} confirm="Se pedirá al cliente otro comprobante. ¿Continuar?" />
                  )}
                </div>
              )}

              {s === "pagado" && <Op orderId={o.id} op="preparar" label="Marcar en preparación" style={btnGhost} />}

              {(s === "pagado" || s === "preparando") && (
                <Op orderId={o.id} op="despachar" label="Despachar y avisar" confirm="Se enviará al cliente la agencia y el número de guía. ¿Continuar?">
                  <input name="courier" placeholder="Agencia (Olva, Shalom, motorizado…)" required className={field} />
                  <input name="tracking" placeholder="Número de guía" required className={field} />
                </Op>
              )}

              {["pagado", "preparando", "despachado"].includes(s) && (
                <Op orderId={o.id} op="entregar" label="Marcar como entregado" style={btnGhost} confirm="¿El cliente ya recibió el pedido?" />
              )}

              {canCancel && (
                <Op orderId={o.id} op="cancelar" label="Cancelar pedido" style={btnDanger} confirm="¿Cancelar el pedido? El stock vuelve a estar disponible." />
              )}

              {!canCancel && s !== "despachado" && <p className="text-sm text-neutral-500">Este pedido ya está cerrado.</p>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
