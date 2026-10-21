import type { OrderStatus } from "@/lib/types";

const STEPS = ["Pago", "Preparando", "En camino", "Entregado"] as const;
const stepOf: Record<OrderStatus, number> = {
  pendiente_pago: 0,
  pago_en_revision: 0,
  pagado: 1,
  preparando: 1,
  despachado: 2,
  entregado: 4,
  cancelado: -1,
  vencido: -1,
};

/** Barra de progreso del pedido: los pasos completados en negro, el actual resaltado. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  const done = stepOf[status];
  if (done < 0) return null;
  return (
    <ol className="mt-5 grid grid-cols-4 gap-2">
      {STEPS.map((s, i) => {
        const complete = i < done;
        const current = i === done;
        return (
          <li key={s}>
            <div className={`h-1.5 rounded-full ${complete ? "bg-ink" : current ? "bg-wine" : "bg-line"}`} />
            <p className={`mt-2 text-[11px] ${complete || current ? "font-semibold text-ink" : "text-neutral-400"}`}>{s}</p>
          </li>
        );
      })}
    </ol>
  );
}
