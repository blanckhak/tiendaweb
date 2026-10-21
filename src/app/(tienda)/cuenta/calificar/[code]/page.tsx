import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ReviewForm } from "@/components/cuenta/review-form";
import { Stars } from "@/components/stars";
import { currentCustomerId } from "@/server/customer-auth";
import { reviewableItems } from "@/server/reviews";

export const metadata: Metadata = { title: "Califica tu compra", robots: { index: false } };

export default function RatePage({ params }: PageProps<"/cuenta/calificar/[code]">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Suspense fallback={<div className="min-h-[50vh] animate-pulse bg-mist" />}>
        <Rate params={params} />
      </Suspense>
    </div>
  );
}

async function Rate({ params }: Pick<PageProps<"/cuenta/calificar/[code]">, "params">) {
  const { code } = await params;
  const id = await currentCustomerId();
  if (!id) redirect(`/cuenta/ingresar?next=${encodeURIComponent(`/cuenta/calificar/${code}`)}`);
  const info = await reviewableItems(id, decodeURIComponent(code));
  if (!info) notFound(); // pedido de otro cliente o inexistente

  return (
    <>
      <Link href="/cuenta#pedidos" className="text-sm text-neutral-500 hover:underline">← Mis pedidos</Link>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Pedido {code.toUpperCase()}</p>
      <h1 className="mt-2 text-4xl">¿Qué te pareció?</h1>
      <p className="mt-3 text-sm text-neutral-600">Tu opinión ayuda a otros clientes a elegir. Toma menos de un minuto.</p>

      {!info.delivered ? (
        <p className="mt-8 bg-mist p-6 text-sm">Podrás calificar cuando recibas tu pedido. 📦</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {info.items.map((i) => (
            <li key={i.product_id} className="border border-line bg-white p-6">
              <p className="text-xs uppercase tracking-wider text-neutral-500">{i.brand}</p>
              <p className="text-lg">{i.name}</p>
              <div className="mt-4">
                {i.rating ? (
                  <p className="flex items-center gap-2 text-sm text-neutral-600">
                    <Stars value={i.rating} /> Ya lo calificaste{i.status === "pendiente" ? " (en revisión)" : ""}. ¡Gracias!
                  </p>
                ) : (
                  <ReviewForm code={code.toUpperCase()} productId={i.product_id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
