/* eslint-disable @next/next/no-img-element -- fotos subidas por clientes */
import Link from "next/link";
import { Suspense } from "react";
import { moderateReviewAction } from "@/app/admin/actions";
import { Card, Loading, PageTitle, btn, btnDanger, btnGhost, dateTime } from "@/components/admin/ui";
import { Stars } from "@/components/stars";
import { requireAdmin } from "@/server/auth";
import { listReviewsForAdmin } from "@/server/reviews";
import { publicUrl } from "@/server/storage";

export default function ReviewsPage({ searchParams }: PageProps<"/admin/resenas">) {
  return (
    <>
      <PageTitle>Reseñas</PageTitle>
      <Suspense fallback={<Loading />}>
        <Reviews searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const filters = [
  { value: "pendiente", label: "Por revisar" },
  { value: "aprobada", label: "Publicadas" },
  { value: "rechazada", label: "Rechazadas" },
];

async function Reviews({ searchParams }: Pick<PageProps<"/admin/resenas">, "searchParams">) {
  await requireAdmin();
  const raw = (await searchParams).estado;
  const status = typeof raw === "string" && filters.some((f) => f.value === raw) ? raw : "pendiente";
  const reviews = await listReviewsForAdmin(status);

  return (
    <>
      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <Link key={f.value} href={`/admin/resenas?estado=${f.value}`} className={`rounded-full border px-3 py-1 text-sm ${status === f.value ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            {f.label}
          </Link>
        ))}
      </div>
      {reviews.length === 0 ? (
        <Card><p className="text-sm text-neutral-500">No hay reseñas aquí.</p></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.brand} {r.name}</p>
                  <p className="text-xs text-neutral-500">{r.first_name} {r.last_name} · pedido {r.code} · {dateTime(r.created_at)}</p>
                </div>
                <Stars value={r.rating} />
              </div>
              {r.body && <p className="mt-3 text-sm">{r.body}</p>}
              {r.photo_key && <img src={publicUrl(r.photo_key)} alt="Foto del cliente" className="mt-3 h-40 rounded object-cover" />}
              <div className="mt-4 flex gap-2">
                {r.status !== "aprobada" && (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="status" value="aprobada" />
                    <button className={btn}>Publicar</button>
                  </form>
                )}
                {r.status !== "rechazada" && (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <input type="hidden" name="status" value="rechazada" />
                    <button className={r.status === "aprobada" ? btnGhost : btnDanger}>{r.status === "aprobada" ? "Ocultar" : "Rechazar"}</button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
