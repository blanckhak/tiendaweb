import Link from "next/link";
import { Suspense } from "react";
import { OrdersTable } from "@/components/admin/orders-table";
import { Card, Loading, PageTitle } from "@/components/admin/ui";
import { soles } from "@/lib/format";
import { statusLabel } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";
import { aiEnabled } from "@/server/bot";
import { requireAdmin } from "@/server/auth";
import { query } from "@/server/db";
import { dashboardCounts, listOrders } from "@/server/orders";
import { whatsappLive } from "@/server/whatsapp";

export default function DashboardPage() {
  return (
    <>
      <PageTitle>Resumen</PageTitle>
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

const todo: { status: OrderStatus; hint: string }[] = [
  { status: "pago_en_revision", hint: "Revisa el comprobante y aprueba" },
  { status: "pagado", hint: "Prepara y despacha" },
  { status: "preparando", hint: "Registra agencia y guía" },
  { status: "pendiente_pago", hint: "Confirma el envío por WhatsApp" },
];

async function Dashboard() {
  await requireAdmin();
  const [counts, recent, [lowStock], [waitingHuman], [pendingQuotes]] = await Promise.all([
    dashboardCounts(),
    listOrders(),
    query<{ n: number }>("select count(*)::int as n from product_variants where stock - reserved <= 3"),
    query<{ n: number }>("select count(*)::int as n from customers where bot_paused"),
    query<{ n: number }>("select count(*)::int as n from quotes where status = 'solicitada'"),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {todo.map((t) => (
          <Link key={t.status} href={`/admin/pedidos?estado=${t.status}`} className="rounded-lg border border-line bg-white p-5 hover:border-ink">
            <p className="text-3xl font-semibold">{counts.byStatus[t.status] ?? 0}</p>
            <p className="mt-1 text-sm font-medium">{statusLabel[t.status]}</p>
            <p className="text-xs text-neutral-500">{t.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ventas del mes">
          <p className="text-3xl font-semibold">{soles(counts.month_cents / 100)}</p>
          <p className="text-sm text-neutral-500">{counts.month_orders} pedidos pagados (sin envío)</p>
        </Card>
        <Card title="Atención">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/admin/cotizaciones?estado=solicitada" className="hover:underline">
                <b>{pendingQuotes.n}</b> cotizaciones por responder
              </Link>
            </li>
            <li>
              <Link href="/admin/chats?filtro=humano" className="hover:underline">
                <b>{waitingHuman.n}</b> chats atendidos por una persona (bot en pausa)
              </Link>
            </li>
            <li>
              <Link href="/admin/productos" className="hover:underline">
                <b>{lowStock.n}</b> presentaciones con 3 unidades o menos
              </Link>
            </li>
          </ul>
        </Card>
        <Card title="Conexiones">
          <ul className="space-y-2 text-sm">
            <li>{whatsappLive() ? "🟢 WhatsApp conectado a Meta" : "🟡 WhatsApp en modo simulado (faltan credenciales de Meta)"}</li>
            <li>{aiEnabled() ? "🟢 Bot con IA (Claude) activo" : "🟡 Bot sin IA: responde con un menú (falta ANTHROPIC_API_KEY)"}</li>
            <li>
              {process.env.DATABASE_URL && !/@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL)
                ? "🟢 Base de datos en la nube"
                : "🟡 Base de datos local (.data/pglite)"}
            </li>
          </ul>
        </Card>
      </div>

      <Card title="Últimos pedidos">
        <OrdersTable orders={recent.slice(0, 8)} />
      </Card>
    </div>
  );
}
