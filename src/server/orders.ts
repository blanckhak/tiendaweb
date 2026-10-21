import "server-only";
import { z } from "zod";
import { departamentos, store } from "@/lib/config";
import { normalizePhone } from "@/lib/phone";
import { qualifiesFreeShipping } from "@/lib/shipping";
import type { OrderStatus } from "@/lib/types";
import { schedule, sendNow } from "./automations";
import { query, tx, type Query } from "./db";
import { notifyOwner } from "./whatsapp";

export const LOW_STOCK = 3;
/** Pedidos sin pagar permitidos por número: evita que alguien bloquee el stock con pedidos falsos. */
export const MAX_UNPAID_PER_PHONE = 3;

const text = (max: number) => z.string().trim().max(max);

export const orderInput = z
  .object({
    firstName: text(60).min(1, "Ingresa tu nombre"),
    lastName: text(80),
    phone: z.string().transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) ctx.addIssue({ code: "custom", message: "Número de WhatsApp inválido" });
      return p ?? "";
    }),
    document: text(15).optional(),
    email: z.union([z.literal(""), z.email().max(120)]).optional(),
    acceptsMarketing: z.boolean().default(false),
    delivery: z.enum(["domicilio", "tienda"]),
    departamento: z.string().optional(),
    provincia: text(60).optional(),
    distrito: text(60).optional(),
    address: text(160).optional(),
    reference: text(160).optional(),
    payment: z.enum(["yape", "plin"]),
    items: z
      .array(z.object({ variantId: z.number().int().positive(), qty: z.number().int().min(1).max(200) }))
      .min(1, "Tu bolsa está vacía")
      .max(30),
  })
  .superRefine((o, ctx) => {
    if (o.delivery !== "domicilio") return;
    if (!o.departamento || !departamentos.includes(o.departamento))
      ctx.addIssue({ code: "custom", path: ["departamento"], message: "Elige un departamento" });
    for (const k of ["provincia", "distrito", "address"] as const)
      if (!o[k]) ctx.addIssue({ code: "custom", path: [k], message: "Completa la dirección" });
  });

export type OrderInput = z.input<typeof orderInput>;

export class OrderError extends Error {}

/** Pedido que nace de una cotización aceptada: usa los precios, descuento y envío cotizados. */
export type FromQuote = { id: number; prices: Map<number, number>; discountCents: number; shippingCents: number | null };

export type CreatedOrder = {
  code: string;
  /** compareAt: precio normal por unidad cuando la línea se vendió en oferta. */
  lines: { brand: string; name: string; ml: number; qty: number; price: number; compareAt?: number }[];
  subtotal: number;
  /** 0 = envío gratis; null = se confirma por WhatsApp. */
  shipping: number | null;
};

/**
 * Crea el pedido en una transacción: bloquea las variantes, verifica stock disponible,
 * reserva las unidades por 24 h y programa recordatorios y vencimiento.
 * Los precios siempre salen de la base de datos, nunca del navegador.
 */
export async function createOrder(raw: OrderInput, quote?: FromQuote): Promise<CreatedOrder> {
  const input = orderInput.parse(raw);

  // Une líneas repetidas de la misma variante.
  const qtyByVariant = new Map<number, number>();
  for (const i of input.items) qtyByVariant.set(i.variantId, (qtyByVariant.get(i.variantId) ?? 0) + i.qty);
  const ids = [...qtyByVariant.keys()].sort((a, b) => a - b); // orden fijo evita bloqueos cruzados

  return tx(async (q) => {
    if (quote) {
      // La cotización se bloquea y se acepta en la misma transacción: no puede convertirse dos veces.
      const [qt] = await q<{ status: string; valid_until: Date | null }>("select status, valid_until from quotes where id = $1 for update", [quote.id]);
      if (qt?.status !== "enviada") throw new OrderError("Esta cotización ya no se puede aceptar.");
      if (qt.valid_until && new Date(qt.valid_until).getTime() < Date.now()) throw new OrderError("La cotización venció. Pide una nueva por WhatsApp.");
    }
    const variants = await q<{ id: number; ml: number; price_cents: number; compare_at_cents: number | null; stock: number; reserved: number; brand: string; name: string; active: boolean }>(
      `select v.id, v.ml, v.price_cents, v.compare_at_cents, v.stock, v.reserved, p.brand, p.name, p.active
       from product_variants v join products p on p.id = v.product_id
       where v.id = any($1::int[]) order by v.id for update of v`,
      [ids],
    );
    if (variants.length !== ids.length) throw new OrderError("Uno de los perfumes ya no está disponible.");

    const lines = variants.map((v) => {
      const qty = qtyByVariant.get(v.id)!;
      const available = v.stock - v.reserved;
      if (!v.active || available < qty)
        throw new OrderError(
          available > 0
            ? `Solo quedan ${available} unidades de ${v.brand} ${v.name} ${v.ml} ml.`
            : `${v.brand} ${v.name} ${v.ml} ml se agotó.`,
        );
      const priceCents = quote?.prices.get(v.id) ?? v.price_cents;
      // La oferta solo se muestra con el precio de lista: una cotización tiene su propio precio.
      const compareAtCents = !quote && v.compare_at_cents && v.compare_at_cents > priceCents ? v.compare_at_cents : null;
      return { variantId: v.id, brand: v.brand, name: v.name, ml: v.ml, qty, priceCents, compareAtCents };
    });
    const subtotalCents = lines.reduce((s, l) => s + l.qty * l.priceCents, 0);

    const [{ unpaid }] = await q<{ unpaid: number }>(
      `select count(*)::int as unpaid from orders o join customers c on c.id = o.customer_id
       where c.phone = $1 and o.status in ('pendiente_pago', 'pago_en_revision')`,
      [input.phone],
    );
    if (unpaid >= MAX_UNPAID_PER_PHONE)
      throw new OrderError("Ya tienes pedidos pendientes de pago. Escríbenos por WhatsApp y te ayudamos a completarlos.");

    const [customer] = await q<{ id: number }>(
      `insert into customers (phone, first_name, last_name, document, email, accepts_marketing, departamento, provincia, distrito, address, reference)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (phone) do update set first_name = excluded.first_name, last_name = excluded.last_name,
         document = coalesce(excluded.document, customers.document), email = coalesce(excluded.email, customers.email),
         accepts_marketing = customers.accepts_marketing or excluded.accepts_marketing,
         departamento = coalesce(excluded.departamento, customers.departamento), provincia = coalesce(excluded.provincia, customers.provincia),
         distrito = coalesce(excluded.distrito, customers.distrito), address = coalesce(excluded.address, customers.address),
         reference = coalesce(excluded.reference, customers.reference)
       returning id`,
      [input.phone, input.firstName, input.lastName, input.document || null, input.email || null, input.acceptsMarketing,
       ...(input.delivery === "domicilio"
         ? [input.departamento, input.provincia, input.distrito, input.address, input.reference || null]
         : [null, null, null, null, null])],
    );

    const home = input.delivery === "domicilio";
    // Envío: el de la cotización si existe; si no, gratis cuando califica; si no, se confirma por WhatsApp.
    const shippingCents =
      quote?.shippingCents ?? (home && qualifiesFreeShipping(subtotalCents / 100, input.departamento) ? 0 : null);
    const [order] = await q<{ id: number; code: string }>(
      `insert into orders (code, customer_id, delivery_method, departamento, provincia, distrito, address, reference,
                           payment_method, subtotal_cents, reserved_until, discount_cents, shipping_cents, quote_id)
       values ('AUR-' || nextval('order_number_seq'), $1, $2, $3, $4, $5, $6, $7, $8, $9, now() + make_interval(hours => $10), $11, $12, $13)
       returning id, code`,
      [customer.id, input.delivery, home ? input.departamento : null, home ? input.provincia : null, home ? input.distrito : null,
       home ? input.address : null, home ? input.reference || null : null, input.payment, subtotalCents, store.reservationHours,
       quote?.discountCents ?? 0, shippingCents, quote?.id ?? null],
    );
    if (quote) await q("update quotes set status = 'aceptada', order_id = $2, updated_at = now() where id = $1", [quote.id, order.id]);

    for (const l of lines) {
      await q(
        `insert into order_items (order_id, variant_id, brand, name, ml, qty, price_cents) values ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, l.variantId, l.brand, l.name, l.ml, l.qty, l.priceCents],
      );
      await q("update product_variants set reserved = reserved + $2 where id = $1", [l.variantId, l.qty]);
    }

    for (const type of ["recordatorio_pago", "ultimo_aviso_pago", "pedido_vencido"] as const)
      await schedule(q, type, { orderId: order.id, customerId: customer.id });

    return {
      code: order.code,
      lines: lines.map((l) => ({
        brand: l.brand,
        name: l.name,
        ml: l.ml,
        qty: l.qty,
        price: l.priceCents / 100,
        ...(l.compareAtCents ? { compareAt: l.compareAtCents / 100 } : {}),
      })),
      subtotal: subtotalCents / 100,
      shipping: shippingCents === null ? null : shippingCents / 100,
    };
  });
}

// ---------- Consultas ----------

export type OrderSummary = {
  id: number;
  code: string;
  status: OrderStatus;
  created_at: Date;
  first_name: string;
  last_name: string;
  phone: string;
  customer_id: number;
  payment_method: string;
  delivery_method: string;
  total_cents: number;
  shipping_cents: number | null;
  items: number;
};

const ORDER_SELECT = `
  select o.id, o.code, o.status, o.created_at, o.payment_method, o.delivery_method, o.shipping_cents,
         o.subtotal_cents - o.discount_cents + coalesce(o.shipping_cents, 0) as total_cents,
         c.id as customer_id, c.first_name, c.last_name, c.phone,
         (select coalesce(sum(qty), 0)::int from order_items where order_id = o.id) as items
  from orders o join customers c on c.id = o.customer_id`;

export function listOrders(status?: OrderStatus) {
  return status
    ? query<OrderSummary>(`${ORDER_SELECT} where o.status = $1 order by o.created_at desc limit 200`, [status])
    : query<OrderSummary>(`${ORDER_SELECT} order by o.created_at desc limit 200`);
}

export async function getOrder(code: string) {
  const [o] = await query<
    OrderSummary & {
      departamento: string | null; provincia: string | null; distrito: string | null; address: string | null; reference: string | null;
      courier: string | null; tracking_number: string | null; subtotal_cents: number; discount_cents: number;
      reserved_until: Date | null; document: string | null; email: string | null; notes: string | null;
    }
  >(
    `${ORDER_SELECT.replace("select o.id,", "select o.*, c.document, c.email, o.id,")} where o.code = $1`,
    [code],
  );
  if (!o) return null;
  const items = await query<{ brand: string; name: string; ml: number; qty: number; price_cents: number }>(
    "select brand, name, ml, qty, price_cents from order_items where order_id = $1 order by id",
    [o.id],
  );
  const payments = await query<{ id: number; method: string; receipt_key: string | null; status: string; created_at: Date }>(
    "select id, method, receipt_key, status, created_at from payments where order_id = $1 order by created_at desc",
    [o.id],
  );
  return { ...o, items: items, payments };
}

export async function dashboardCounts() {
  const rows = await query<{ status: OrderStatus; n: number }>("select status, count(*)::int as n from orders group by status");
  const [sales] = await query<{ month_cents: number; month_orders: number }>(
    `select coalesce(sum(subtotal_cents - discount_cents), 0)::int as month_cents, count(*)::int as month_orders
     from orders where status in ('pagado', 'preparando', 'despachado', 'entregado')
       and created_at >= date_trunc('month', now())`,
  );
  return { byStatus: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<OrderStatus, number>>, ...sales };
}

// ---------- Cambios de estado (panel admin) ----------

async function lockOrder(q: Query, id: number) {
  const [o] = await q<{ id: number; code: string; status: OrderStatus; customer_id: number }>(
    "select id, code, status, customer_id from orders where id = $1 for update",
    [id],
  );
  if (!o) throw new OrderError("Pedido no encontrado.");
  return o;
}

function assertStatus(o: { status: OrderStatus; code: string }, allowed: OrderStatus[], action: string) {
  if (!allowed.includes(o.status)) throw new OrderError(`No se puede ${action}: el pedido ${o.code} está "${o.status}".`);
}

/** Aprueba el pago: la reserva se convierte en venta (baja el stock físico). */
export async function approvePayment(orderId: number) {
  const { customerId, lowStock } = await tx(async (q) => {
    const o = await lockOrder(q, orderId);
    assertStatus(o, ["pendiente_pago", "pago_en_revision"], "aprobar el pago");
    await q(
      `update product_variants v set stock = v.stock - oi.qty, reserved = greatest(v.reserved - oi.qty, 0)
       from order_items oi where oi.order_id = $1 and oi.variant_id = v.id`,
      [orderId],
    );
    await q("update payments set status = 'aprobado', reviewed_at = now() where order_id = $1 and status = 'en_revision'", [orderId]);
    await q("update orders set status = 'pagado', reserved_until = null, updated_at = now() where id = $1", [orderId]);
    await q(
      `update automation_jobs set status = 'omitido', result = 'pedido pagado'
       where order_id = $1 and status = 'pendiente' and type in ('recordatorio_pago', 'ultimo_aviso_pago', 'pedido_vencido')`,
      [orderId],
    );
    const lowStock = await q<{ label: string; available: number }>(
      `select p.brand || ' ' || p.name || ' ' || v.ml || ' ml' as label, (v.stock - v.reserved)::int as available
       from order_items oi join product_variants v on v.id = oi.variant_id join products p on p.id = v.product_id
       where oi.order_id = $1 and v.stock - v.reserved <= $2`,
      [orderId, LOW_STOCK],
    );
    return { customerId: o.customer_id, lowStock };
  });
  await sendNow("pago_validado", { orderId, customerId });
  if (lowStock.length)
    await notifyOwner(`Stock bajo: ${lowStock.map((l) => `${l.label} (${l.available})`).join(", ")}`);
}

export async function rejectPayment(orderId: number) {
  const customerId = await tx(async (q) => {
    const o = await lockOrder(q, orderId);
    assertStatus(o, ["pago_en_revision"], "rechazar el comprobante");
    await q("update payments set status = 'rechazado', reviewed_at = now() where order_id = $1 and status = 'en_revision'", [orderId]);
    await q("update orders set status = 'pendiente_pago', updated_at = now() where id = $1", [orderId]);
    return o.customer_id;
  });
  await sendNow("pago_rechazado", { orderId, customerId });
}

export async function markPreparing(orderId: number) {
  await tx(async (q) => {
    const o = await lockOrder(q, orderId);
    assertStatus(o, ["pagado"], "pasar a preparación");
    await q("update orders set status = 'preparando', updated_at = now() where id = $1", [orderId]);
  });
}

export async function shipOrder(orderId: number, courier: string, tracking: string) {
  const customerId = await tx(async (q) => {
    const o = await lockOrder(q, orderId);
    assertStatus(o, ["pagado", "preparando"], "despachar");
    await q(
      "update orders set status = 'despachado', courier = $2, tracking_number = $3, updated_at = now() where id = $1",
      [orderId, courier, tracking],
    );
    return o.customer_id;
  });
  await sendNow("pedido_despachado", { orderId, customerId });
}

export async function deliverOrder(orderId: number) {
  const customerId = await tx(async (q) => {
    const o = await lockOrder(q, orderId);
    assertStatus(o, ["pagado", "preparando", "despachado"], "marcar como entregado");
    await q("update orders set status = 'entregado', updated_at = now() where id = $1", [orderId]);
    await schedule(q, "pedir_resena", {
      orderId,
      customerId: o.customer_id,
      payload: { link: `${store.siteUrl}/cuenta/calificar/${o.code}` },
    });
    await schedule(q, "recompra", { orderId, customerId: o.customer_id });
    return o.customer_id;
  });
  await sendNow("pedido_entregado", { orderId, customerId });
}

/** Cancela: si no estaba pagado libera la reserva; si ya estaba pagado devuelve las unidades al stock. */
export async function cancelOrder(orderId: number) {
  await tx(async (q) => {
    const o = await lockOrder(q, orderId);
    assertStatus(o, ["pendiente_pago", "pago_en_revision", "pagado", "preparando"], "cancelar");
    if (o.status === "pendiente_pago" || o.status === "pago_en_revision") {
      await q(
        `update product_variants v set reserved = greatest(v.reserved - oi.qty, 0)
         from order_items oi where oi.order_id = $1 and oi.variant_id = v.id`,
        [orderId],
      );
    } else {
      await q(
        `update product_variants v set stock = v.stock + oi.qty
         from order_items oi where oi.order_id = $1 and oi.variant_id = v.id`,
        [orderId],
      );
    }
    await q("update orders set status = 'cancelado', reserved_until = null, updated_at = now() where id = $1", [orderId]);
    await q("update automation_jobs set status = 'omitido', result = 'pedido cancelado' where order_id = $1 and status = 'pendiente'", [orderId]);
  });
}

export async function setShipping(orderId: number, shippingCents: number) {
  await query("update orders set shipping_cents = $2, updated_at = now() where id = $1", [orderId, shippingCents]);
}

/** El cliente mandó un comprobante por WhatsApp: se adjunta a su pedido pendiente más reciente. */
export async function attachReceipt(customerId: number, receiptKey: string) {
  const order = await tx(async (q) => {
    const [o] = await q<{ id: number; code: string; payment_method: string }>(
      `select id, code, payment_method from orders
       where customer_id = $1 and status in ('pendiente_pago', 'pago_en_revision')
       order by created_at desc limit 1 for update`,
      [customerId],
    );
    if (!o) return null;
    await q("insert into payments (order_id, method, receipt_key) values ($1, $2, $3)", [o.id, o.payment_method, receiptKey]);
    await q("update orders set status = 'pago_en_revision', updated_at = now() where id = $1", [o.id]);
    return o;
  });
  if (order) {
    await sendNow("comprobante_recibido", { orderId: order.id, customerId });
    await notifyOwner(`Comprobante recibido para ${order.code}. Revísalo en el panel.`);
  }
  return order;
}
