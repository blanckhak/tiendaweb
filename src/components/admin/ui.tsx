import { statusLabel, statusTone } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";

export const btn = "inline-flex items-center justify-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3.5 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50";
export const btnDanger = "inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3.5 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50";
export const field = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[status]}`}>{statusLabel[status]}</span>;
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-white p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>}
      {children}
    </section>
  );
}

export function PageTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {aside}
    </div>
  );
}

export const Loading = () => <div className="h-40 animate-pulse rounded-lg bg-neutral-100" />;

export const dateTime = (d: Date | string) =>
  new Date(d).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });
