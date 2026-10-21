import type { OrderStatus } from "./types";

export const statusLabel: Record<OrderStatus, string> = {
  pendiente_pago: "Pendiente de pago",
  pago_en_revision: "Pago en revisión",
  pagado: "Pagado",
  preparando: "Preparando",
  despachado: "Despachado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

export const statusTone: Record<OrderStatus, string> = {
  pendiente_pago: "bg-amber-100 text-amber-800",
  pago_en_revision: "bg-sky-100 text-sky-800",
  pagado: "bg-emerald-100 text-emerald-800",
  preparando: "bg-indigo-100 text-indigo-800",
  despachado: "bg-violet-100 text-violet-800",
  entregado: "bg-neutral-200 text-neutral-800",
  cancelado: "bg-red-100 text-red-800",
  vencido: "bg-red-100 text-red-800",
};
