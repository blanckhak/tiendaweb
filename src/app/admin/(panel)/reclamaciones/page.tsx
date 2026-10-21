import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageTitle, dateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth";
import { listComplaints } from "@/server/complaints";

export default function ComplaintsPage() {
  return (
    <>
      <PageTitle>Libro de Reclamaciones</PageTitle>
      <Suspense fallback={<Loading />}>
        <Complaints />
      </Suspense>
    </>
  );
}

async function Complaints() {
  await requireAdmin();
  const rows = await listComplaints();
  return (
    <Card>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay hojas de reclamación. 🎉</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="py-2 pr-4">N°</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Consumidor</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2">Plazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => {
                const days = c.days_left;
                return (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="py-2.5 pr-4"><Link href={`/admin/reclamaciones/${c.code}`} className="font-medium hover:underline">{c.code}</Link></td>
                    <td className="py-2.5 pr-4 capitalize">{c.kind}</td>
                    <td className="py-2.5 pr-4">{c.full_name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "pendiente" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {c.status === "pendiente" ? "Pendiente" : "Respondido"}
                      </span>
                    </td>
                    <td className={`py-2.5 ${c.status === "pendiente" && days <= 3 ? "font-semibold text-red-700" : "text-neutral-500"}`}>
                      {c.status === "pendiente" ? (days < 0 ? `Vencido hace ${-days} días` : `${dateTime(c.due_at)} (${days} días)`) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
