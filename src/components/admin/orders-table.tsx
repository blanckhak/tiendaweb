import Link from "next/link";
import { soles } from "@/lib/format";
import type { OrderSummary } from "@/server/orders";
import { StatusBadge, dateTime } from "./ui";

export function OrdersTable({ orders }: { orders: OrderSummary[] }) {
  if (!orders.length) return <p className="text-sm text-neutral-500">Todavía no hay pedidos.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="py-2 pr-4">Pedido</th>
            <th className="py-2 pr-4">Cliente</th>
            <th className="py-2 pr-4">Estado</th>
            <th className="py-2 pr-4 text-right">Total</th>
            <th className="py-2">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-neutral-50">
              <td className="py-2.5 pr-4">
                <Link href={`/admin/pedidos/${o.code}`} className="font-medium underline-offset-2 hover:underline">
                  {o.code}
                </Link>
                <span className="ml-2 text-xs text-neutral-500">{o.items} u.</span>
              </td>
              <td className="py-2.5 pr-4">{o.first_name} {o.last_name}</td>
              <td className="py-2.5 pr-4"><StatusBadge status={o.status} /></td>
              <td className="py-2.5 pr-4 text-right">
                {soles(o.total_cents / 100)}
                {o.shipping_cents === null && <span className="block text-xs text-amber-700">+ envío</span>}
              </td>
              <td className="py-2.5 text-neutral-500">{dateTime(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
