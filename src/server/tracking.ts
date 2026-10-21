import "server-only";
import type { OrderStatus } from "@/lib/types";
import { query } from "./db";

export type TrackedOrder = {
  code: string;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
  delivery_method: "domicilio" | "tienda";
  distrito: string | null;
  courier: string | null;
  tracking_number: string | null;
  total_cents: number;
  shipping_cents: number | null;
  items: { qty: number; brand: string; name: string; ml: number }[];
};

// Límite simple por IP: frena a quien pruebe códigos y teléfonos al azar.
const attempts = new Map<string, { n: number; since: number }>();
const MAX_ATTEMPTS = 15;
const WINDOW_MS = 10 * 60 * 1000;

export function tooManyAttempts(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now - a.since > WINDOW_MS) {
    attempts.set(ip, { n: 1, since: now });
    return false;
  }
  a.n++;
  return a.n > MAX_ATTEMPTS;
}

/**
 * Busca un pedido por su código y los 4 últimos dígitos del WhatsApp con el que se hizo.
 * Sin el segundo dato no se muestra nada (los códigos son correlativos y fáciles de adivinar).
 * Nunca devuelve nombre, dirección completa ni teléfono.
 */
export async function trackOrder(codeInput: string, last4: string): Promise<TrackedOrder | null> {
  const code = codeInput.trim().toUpperCase().replace(/^(\d+)$/, "AUR-$1");
  if (!/^AUR-\d{3,}$/.test(code) || !/^\d{4}$/.test(last4)) return null;
  const [o] = await query<Omit<TrackedOrder, "items"> & { id: number; phone: string | null }>(
    `select o.id, o.code, o.status, o.created_at, o.updated_at, o.delivery_method, o.distrito, o.courier, o.tracking_number,
            o.shipping_cents, o.subtotal_cents - o.discount_cents + coalesce(o.shipping_cents, 0) as total_cents, c.phone
     from orders o join customers c on c.id = o.customer_id where o.code = $1`,
    [code],
  );
  if (!o || !o.phone?.endsWith(last4)) return null;
  const items = await query<TrackedOrder["items"][number]>(
    "select qty, brand, name, ml from order_items where order_id = $1 order by id",
    [o.id],
  );
  // Solo datos de seguimiento: nunca el teléfono ni ids internos.
  return {
    code: o.code,
    status: o.status,
    created_at: o.created_at,
    updated_at: o.updated_at,
    delivery_method: o.delivery_method,
    distrito: o.distrito,
    courier: o.courier,
    tracking_number: o.tracking_number,
    total_cents: o.total_cents,
    shipping_cents: o.shipping_cents,
    items,
  };
}
