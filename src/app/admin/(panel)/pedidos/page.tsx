import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageTitle } from "@/components/admin/ui";
import { statusLabel } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";
import { requireAdmin } from "@/server/auth";
import { listOrders } from "@/server/orders";
import { OrdersTable } from "@/components/admin/orders-table";

export default function OrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  return (
    <>
      <PageTitle>Pedidos</PageTitle>
      <Suspense fallback={<Loading />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/pedidos">, "searchParams">) {
  await requireAdmin();
  const raw = (await searchParams).estado;
  const status = (typeof raw === "string" && raw in statusLabel ? raw : undefined) as OrderStatus | undefined;
  const orders = await listOrders(status);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/pedidos" className={`rounded-full border px-3 py-1 text-sm ${!status ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
          Todos
        </Link>
        {(Object.keys(statusLabel) as OrderStatus[]).map((s) => (
          <Link
            key={s}
            href={`/admin/pedidos?estado=${s}`}
            className={`rounded-full border px-3 py-1 text-sm ${status === s ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
          >
            {statusLabel[s]}
          </Link>
        ))}
      </div>
      <Card>
        <OrdersTable orders={orders} />
      </Card>
    </>
  );
}
