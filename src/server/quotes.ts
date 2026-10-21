import "server-only";
import { z } from "zod";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { sendNow } from "./automations";
import { query, tx } from "./db";
import { createOrder, OrderError, type CreatedOrder } from "./orders";
import { notifyOwner } from "./whatsapp";

export type QuoteStatus = "solicitada" | "enviada" | "aceptada" | "rechazada" | "vencida";

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  solicitada: "Solicitada",
  enviada: "Lista para aceptar",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

/** Cotizaciones abiertas por cliente: evita que alguien llene la bandeja. */
export const MAX_OPEN_QUOTES = 3;

export type QuoteItem = {
  id: number;
  variant_id: number;
  brand: string;
  name: string;
  ml: number;
  qty: number;
  list_price_cents: number;
  unit_price_cents: number | null;
};

export type Quote = {
  id: number;
  code: string;
  customer_id: number;
  status: QuoteStatus;
  customer_note: string;
  admin_note: string;
  discount_cents: number;
  shipping_cents: number | null;
  valid_until: Date | null;
  order_id: number | null;
  order_code: string | null;
  created_at: Date;
  first_name: string;
  last_name: string;
  phone: string;
  items: QuoteItem[];
};

export const quoteTotals = (q: Pick<Quote, "items" | "discount_cents" | "shipping_cents">) => {
  const subtotal = q.items.reduce((s, i) => s + i.qty * (i.unit_price_cents ?? i.list_price_cents), 0);
  return { subtotal, total: subtotal - q.discount_cents + (q.shipping_cents ?? 0) };
};

const requestInput = z.object({
  note: z.string().trim().max(1000).default(""),
  items: z
    .array(z.object({ variantId: z.number().int().positive(), qty: z.number().int().min(1).max(500) }))
    .min(1, "Agrega al menos un perfume")
    .max(30),
});

/** El cliente (con sesión) pide una cotización. Los precios de lista salen de la base de datos. */
export async function requestQuote(customerId: number, raw: z.input<typeof requestInput>) {
  const input = requestInput.parse(raw);
  const result = await tx(async (q) => {
    const [{ open }] = await q<{ open: number }>(
      "select count(*)::int as open from quotes where customer_id = $1 and status = 'solicitada'",
      [customerId],
    );
    if (open >= MAX_OPEN_QUOTES) throw new OrderError("Ya tienes cotizaciones en revisión. Te responderemos pronto por WhatsApp.");

    const qty = new Map<number, number>();
    for (const i of input.items) qty.set(i.variantId, (qty.get(i.variantId) ?? 0) + i.qty);
    const variants = await q<{ id: number; ml: number; price_cents: number; brand: string; name: string }>(
      `select v.id, v.ml, v.price_cents, p.brand, p.name from product_variants v join products p on p.id = v.product_id
       where v.id = any($1::int[]) and p.active order by p.brand, p.name`,
      [[...qty.keys()]],
    );
    if (variants.length !== qty.size) throw new OrderError("Uno de los perfumes ya no está disponible.");

    const [quote] = await q<{ id: number; code: string }>(
      `insert into quotes (code, customer_id, customer_note) values ('COT-' || nextval('quote_number_seq'), $1, $2) returning id, code`,
      [customerId, input.note],
    );
    for (const v of variants) {
      await q(
        `insert into quote_items (quote_id, variant_id, brand, name, ml, qty, list_price_cents) values ($1, $2, $3, $4, $5, $6, $7)`,
        [quote.id, v.id, v.brand, v.name, v.ml, qty.get(v.id), v.price_cents],
      );
    }
    const units = [...qty.values()].reduce((a, b) => a + b, 0);
    return { ...quote, units };
  });
  await notifyOwner(`Nueva solicitud de cotización ${result.code} (${result.units} unidades). Respóndela desde el panel.`);
  return result;
}

const QUOTE_SELECT = `
  select qt.*, c.first_name, c.last_name, c.phone, o.code as order_code
  from quotes qt join customers c on c.id = qt.customer_id left join orders o on o.id = qt.order_id`;

async function withItems(rows: Omit<Quote, "items">[]): Promise<Quote[]> {
  if (!rows.length) return [];
  const items = await query<QuoteItem & { quote_id: number }>(
    "select * from quote_items where quote_id = any($1::int[]) order by id",
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.quote_id === r.id) }));
}

/** Marca como vencidas las cotizaciones enviadas cuya fecha ya pasó. */
async function expireQuotes() {
  await query("update quotes set status = 'vencida', updated_at = now() where status = 'enviada' and valid_until < now()");
}

export async function getQuote(code: string) {
  await expireQuotes();
  const rows = await query<Omit<Quote, "items">>(`${QUOTE_SELECT} where qt.code = $1`, [code]);
  return (await withItems(rows))[0] ?? null;
}

export async function listQuotes(filter: { customerId?: number; status?: QuoteStatus } = {}) {
  await expireQuotes();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.customerId) where.push(`qt.customer_id = $${params.push(filter.customerId)}`);
  if (filter.status) where.push(`qt.status = $${params.push(filter.status)}`);
  const rows = await query<Omit<Quote, "items">>(
    `${QUOTE_SELECT} ${where.length ? `where ${where.join(" and ")}` : ""} order by qt.created_at desc limit 200`,
    params,
  );
  return withItems(rows);
}

export const sendInput = z.object({
  prices: z.record(z.string(), z.coerce.number().min(0).max(100000)), // id de quote_item → precio unitario en soles
  discount: z.coerce.number().min(0).max(100000).default(0),
  shipping: z.union([z.literal(""), z.coerce.number().min(0).max(10000)]).optional(),
  validDays: z.coerce.number().int().min(1).max(60).default(7),
  note: z.string().trim().max(1000).default(""),
});

/** El admin pone precios y envía la cotización por WhatsApp. */
export async function sendQuote(quoteId: number, raw: z.input<typeof sendInput>) {
  const input = sendInput.parse(raw);
  const quote = await tx(async (q) => {
    const [qt] = await q<{ id: number; code: string; status: QuoteStatus; customer_id: number }>(
      "select id, code, status, customer_id from quotes where id = $1 for update",
      [quoteId],
    );
    if (!qt) throw new OrderError("Cotización no encontrada.");
    if (!["solicitada", "enviada"].includes(qt.status)) throw new OrderError(`La cotización ${qt.code} ya está ${qt.status}.`);
    const items = await q<{ id: number }>("select id from quote_items where quote_id = $1", [quoteId]);
    for (const it of items) {
      const price = input.prices[String(it.id)];
      if (price === undefined) throw new OrderError("Falta el precio de un producto.");
      await q("update quote_items set unit_price_cents = $2 where id = $1", [it.id, Math.round(price * 100)]);
    }
    const [{ subtotal }] = await q<{ subtotal: number }>(
      "select coalesce(sum(qty * unit_price_cents), 0)::int as subtotal from quote_items where quote_id = $1",
      [quoteId],
    );
    if (Math.round(input.discount * 100) > subtotal) throw new OrderError("El descuento es mayor que el subtotal.");
    await q(
      `update quotes set status = 'enviada', discount_cents = $2, shipping_cents = $3, admin_note = $4,
         valid_until = now() + make_interval(days => $5), updated_at = now() where id = $1`,
      [quoteId, Math.round(input.discount * 100), input.shipping === "" || input.shipping === undefined ? null : Math.round(input.shipping * 100), input.note, input.validDays],
    );
    return qt;
  });

  const full = (await getQuote(quote.code))!;
  const { total } = quoteTotals(full);
  const vence = new Date(full.valid_until!).toLocaleDateString("es-PE", { day: "numeric", month: "long", timeZone: "America/Lima" });
  return sendNow("cotizacion_lista", {
    customerId: quote.customer_id,
    payload: {
      vars: {
        codigo: quote.code,
        total: `${soles(total / 100)}${full.shipping_cents === null ? " + envío" : ""}`,
        vence,
        link: `${store.siteUrl}/cuenta/cotizaciones/${quote.code}`,
      },
    },
  });
}

export async function rejectQuote(quoteId: number, customerId?: number) {
  const rows = await query(
    `update quotes set status = 'rechazada', updated_at = now()
     where id = $1 and status in ('solicitada', 'enviada') ${customerId ? "and customer_id = $2" : ""} returning id`,
    customerId ? [quoteId, customerId] : [quoteId],
  );
  if (!rows.length) throw new OrderError("La cotización ya no se puede cambiar.");
}

/** El cliente acepta: se crea el pedido con los precios cotizados y sigue el flujo normal de pago. */
export async function acceptQuote(
  customerId: number,
  code: string,
  delivery: { delivery: "domicilio" | "tienda"; departamento?: string; provincia?: string; distrito?: string; address?: string; reference?: string; payment: "yape" | "plin" },
): Promise<CreatedOrder> {
  const quote = await getQuote(code);
  if (!quote || quote.customer_id !== customerId) throw new OrderError("Cotización no encontrada.");
  if (quote.status !== "enviada") throw new OrderError(`Esta cotización está ${quoteStatusLabel[quote.status].toLowerCase()}.`);
  const [c] = await query<{ first_name: string; last_name: string; phone: string; document: string | null; email: string | null }>(
    "select first_name, last_name, phone, document, email from customers where id = $1",
    [customerId],
  );
  return createOrder(
    {
      firstName: c.first_name || "Cliente",
      lastName: c.last_name,
      phone: c.phone,
      document: c.document ?? undefined,
      email: c.email ?? undefined,
      ...delivery,
      items: quote.items.map((i) => ({ variantId: i.variant_id, qty: i.qty })),
    },
    {
      id: quote.id,
      prices: new Map(quote.items.map((i) => [i.variant_id, i.unit_price_cents ?? i.list_price_cents])),
      discountCents: quote.discount_cents,
      shippingCents: quote.shipping_cents,
    },
  );
}
