import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageTitle, btn } from "@/components/admin/ui";
import { soles } from "@/lib/format";
import { requireAdmin } from "@/server/auth";
import { query } from "@/server/db";

export default function ProductsPage() {
  return (
    <>
      <PageTitle aside={<Link href="/admin/productos/nuevo" className={btn}>+ Nuevo perfume</Link>}>Productos</PageTitle>
      <Suspense fallback={<Loading />}>
        <Products />
      </Suspense>
    </>
  );
}

type Row = {
  id: number | null;
  product_id: number;
  brand: string;
  name: string;
  active: boolean;
  ml: number | null;
  sku: string | null;
  price_cents: number | null;
  stock: number | null;
  reserved: number | null;
};

async function Products() {
  await requireAdmin();
  const rows = await query<Row>(
    `select p.id as product_id, p.brand, p.name, p.active, v.id, v.ml, v.sku, v.price_cents, v.stock, v.reserved
     from products p left join product_variants v on v.product_id = p.id order by p.brand, p.name, v.ml`,
  );
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="py-2 pr-4">Perfume</th>
              <th className="py-2 pr-4">Presentación</th>
              <th className="py-2 pr-4 text-right">Precio</th>
              <th className="py-2 pr-4 text-right">Stock</th>
              <th className="py-2 pr-4 text-right">Reservado</th>
              <th className="py-2 text-right">Disponible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const available = (r.stock ?? 0) - (r.reserved ?? 0);
              return (
                <tr key={`${r.product_id}-${r.id}`} className="hover:bg-neutral-50">
                  <td className="py-2.5 pr-4">
                    <Link href={`/admin/productos/${r.product_id}`} className="font-medium hover:underline">
                      {r.brand} {r.name}
                    </Link>
                    {!r.active && <span className="ml-2 rounded bg-neutral-200 px-1.5 text-xs">oculto</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-neutral-600">{r.ml ? `${r.ml} ml · ${r.sku}` : "—"}</td>
                  <td className="py-2.5 pr-4 text-right">{r.price_cents !== null ? soles(r.price_cents / 100) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right">{r.stock ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-right text-neutral-500">{r.reserved ?? "—"}</td>
                  <td className={`py-2.5 text-right font-medium ${available <= 0 ? "text-red-700" : available <= 3 ? "text-amber-700" : ""}`}>
                    {r.ml ? available : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
