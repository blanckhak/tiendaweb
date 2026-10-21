/* eslint-disable @next/next/no-img-element -- imágenes privadas servidas por /admin/archivo */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { replyAction, toggleBotAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Loading, PageTitle, StatusBadge, btn, btnGhost, dateTime, field } from "@/components/admin/ui";
import { soles } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import type { OrderStatus } from "@/lib/types";
import { requireAdmin } from "@/server/auth";
import { query } from "@/server/db";
import { inServiceWindow } from "@/server/whatsapp";

export default function ChatPage({ params }: PageProps<"/admin/chats/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Chat params={params} />
    </Suspense>
  );
}

type Msg = { id: number; direction: "in" | "out"; author: string; kind: string; body: string; media_key: string | null; status: string; error: string | null; created_at: Date };

const authorLabel: Record<string, string> = { bot: "Bot", humano: "Tú", automatizacion: "Automático" };

async function Chat({ params }: Pick<PageProps<"/admin/chats/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [c] = await query<{ id: number; phone: string; first_name: string; last_name: string; bot_paused: boolean; accepts_marketing: boolean; last_inbound_at: Date | null }>(
    "select id, phone, first_name, last_name, bot_paused, accepts_marketing, last_inbound_at from customers where id = $1",
    [Number(id)],
  );
  if (!c) notFound();
  const [messages, orders] = await Promise.all([
    query<Msg>("select * from (select * from wa_messages where customer_id = $1 order by id desc limit 200) t order by id", [c.id]),
    query<{ code: string; status: OrderStatus; total_cents: number }>(
      `select code, status, subtotal_cents - discount_cents + coalesce(shipping_cents, 0) as total_cents
       from orders where customer_id = $1 order by created_at desc limit 10`,
      [c.id],
    ),
  ]);
  const windowOpen = inServiceWindow(c.last_inbound_at);

  return (
    <>
      <PageTitle aside={<Link href="/admin/chats" className={btnGhost}>← Chats</Link>}>
        {c.first_name || c.last_name ? `${c.first_name} ${c.last_name}` : displayPhone(c.phone)}
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="flex flex-col">
          <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-md bg-[#efeae2] p-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.direction === "out" ? "bg-[#d9fdd3]" : "bg-white"}`}>
                  {m.direction === "out" && <p className="mb-0.5 text-[11px] font-semibold text-emerald-800">{authorLabel[m.author] ?? m.author}</p>}
                  {m.media_key &&
                    (m.media_key.endsWith(".pdf") ? (
                      <a href={`/admin/archivo/${m.media_key}`} target="_blank" className="underline">📄 Ver PDF</a>
                    ) : (
                      <a href={`/admin/archivo/${m.media_key}`} target="_blank">
                        <img src={`/admin/archivo/${m.media_key}`} alt="Imagen enviada" className="mb-1 max-h-60 rounded" />
                      </a>
                    ))}
                  {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                  <p className="mt-1 text-right text-[10px] text-neutral-500">
                    {dateTime(m.created_at)}
                    {m.direction === "out" && m.status !== "enviado" && (
                      <span className={m.status === "error" ? " text-red-700" : ""}> · {m.status}{m.error ? `: ${m.error}` : ""}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <ActionForm action={replyAction} className="mt-4 flex gap-2">
            <input type="hidden" name="customerId" value={c.id} />
            <textarea name="text" rows={2} required placeholder="Escribe una respuesta…" className={`${field} flex-1`} />
            <button className={btn}>Enviar</button>
          </ActionForm>
          {!windowOpen && (
            <p className="mt-2 text-xs text-amber-700">
              El cliente no escribió en las últimas 24 h: WhatsApp solo entrega mensajes libres dentro de esa ventana.
            </p>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Cliente">
            <p className="text-sm">{displayPhone(c.phone)}</p>
            <p className="mt-1 text-xs text-neutral-500">{c.accepts_marketing ? "Acepta mensajes promocionales" : "No aceptó mensajes promocionales"}</p>
            <form action={toggleBotAction} className="mt-4">
              <input type="hidden" name="customerId" value={c.id} />
              <button className={btnGhost}>{c.bot_paused ? "▶ Reactivar el bot" : "⏸ Atender yo (pausar bot)"}</button>
            </form>
            <p className="mt-2 text-xs text-neutral-500">
              {c.bot_paused ? "El bot está en pausa: tú respondes este chat." : "El bot responde automáticamente."}
            </p>
          </Card>
          <Card title="Pedidos">
            {orders.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin pedidos.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {orders.map((o) => (
                  <li key={o.code} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/pedidos/${o.code}`} className="font-medium hover:underline">{o.code}</Link>
                    <span className="text-neutral-500">{soles(o.total_cents / 100)}</span>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
