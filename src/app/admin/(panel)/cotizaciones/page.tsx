import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageTitle, dateTime } from "@/components/admin/ui";
import { soles } from "@/lib/format";
import { requireAdmin } from "@/server/auth";
import { listQuotes, quoteStatusLabel, quoteTotals, type QuoteStatus } from "@/server/quotes";

export default function QuotesPage({ searchParams }: PageProps<"/admin/cotizaciones">) {
  return (
    <>
      <PageTitle>Cotizaciones</PageTitle>
      <Suspense fallback={<Loading />}>
        <Quotes searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const tone: Record<QuoteStatus, string> = {
  solicitada: "bg-amber-100 text-amber-800",
  enviada: "bg-sky-100 text-sky-800",
  aceptada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-neutral-200 text-neutral-700",
  vencida: "bg-red-100 text-red-800",
};

async function Quotes({ searchParams }: Pick<PageProps<"/admin/cotizaciones">, "searchParams">) {
  await requireAdmin();
  const raw = (await searchParams).estado;
  const status = (typeof raw === "string" && raw in quoteStatusLabel ? raw : undefined) as QuoteStatus | undefined;
  const quotes = await listQuotes({ status });

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/cotizaciones" className={`rounded-full border px-3 py-1 text-sm ${!status ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>Todas</Link>
        {(Object.keys(quoteStatusLabel) as QuoteStatus[]).map((s) => (
          <Link key={s} href={`/admin/cotizaciones?estado=${s}`} className={`rounded-full border px-3 py-1 text-sm ${status === s ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            {quoteStatusLabel[s]}
          </Link>
        ))}
      </div>
      <Card>
        {quotes.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay cotizaciones {status ? `en "${quoteStatusLabel[status]}"` : "todavía"}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">Cotización</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4 text-right">Unidades</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50">
                    <td className="py-2.5 pr-4">
                      <Link href={`/admin/cotizaciones/${q.code}`} className="font-medium hover:underline">{q.code}</Link>
                    </td>
                    <td className="py-2.5 pr-4">{q.first_name} {q.last_name}</td>
                    <td className="py-2.5 pr-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[q.status]}`}>{quoteStatusLabel[q.status]}</span></td>
                    <td className="py-2.5 pr-4 text-right">{q.items.reduce((s, i) => s + i.qty, 0)}</td>
                    <td className="py-2.5 pr-4 text-right">{q.status === "solicitada" ? "—" : soles(quoteTotals(q).total / 100)}</td>
                    <td className="py-2.5 text-neutral-500">{dateTime(q.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
