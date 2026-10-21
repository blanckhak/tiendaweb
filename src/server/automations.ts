import "server-only";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { query, tx, type Query } from "./db";
import { inServiceWindow, sendTemplate, sendText } from "./whatsapp";

export type AutomationType =
  | "recordatorio_pago"
  | "ultimo_aviso_pago"
  | "pedido_vencido"
  | "comprobante_recibido"
  | "pago_validado"
  | "pago_rechazado"
  | "pedido_despachado"
  | "pedido_entregado"
  | "pedir_resena"
  | "recompra"
  | "stock_repuesto"
  | "cotizacion_lista";

export const automationInfo: Record<AutomationType, { label: string; when: string; marketing?: boolean }> = {
  recordatorio_pago: { label: "Recordatorio de pago", when: "Pedido sin comprobante" },
  ultimo_aviso_pago: { label: "Último aviso de pago", when: "Pedido sin comprobante, antes de vencer" },
  pedido_vencido: { label: "Pedido vencido", when: "Pasaron 24 h sin pago: se libera el stock" },
  comprobante_recibido: { label: "Comprobante recibido", when: "El cliente envía la captura" },
  pago_validado: { label: "Pago validado", when: "Apruebas el pago en el panel" },
  pago_rechazado: { label: "Comprobante rechazado", when: "Rechazas el comprobante en el panel" },
  pedido_despachado: { label: "Pedido despachado", when: "Registras agencia y guía" },
  pedido_entregado: { label: "Pedido entregado", when: "Marcas el pedido como entregado" },
  pedir_resena: { label: "Pedir reseña", when: "Días después de la entrega", marketing: true },
  recompra: { label: "Recordatorio de recompra", when: "Días después de la entrega", marketing: true },
  stock_repuesto: { label: "Aviso de reposición", when: "Vuelve el stock de un perfume que pidieron" },
  cotizacion_lista: { label: "Cotización lista", when: "Envías una cotización desde el panel" },
};

/** Estados del pedido en los que cada mensaje sigue teniendo sentido al momento de enviarse. */
const validWhen: Partial<Record<AutomationType, OrderStatus[]>> = {
  recordatorio_pago: ["pendiente_pago"],
  ultimo_aviso_pago: ["pendiente_pago"],
  pedido_vencido: ["pendiente_pago"],
  pedir_resena: ["entregado"],
  recompra: ["entregado"],
};

export type Setting = { type: AutomationType; enabled: boolean; delay_minutes: number; template: string; wa_template: string | null };

export const getSettings = () => query<Setting>("select * from automation_settings order by type");

/** Programa un mensaje según la configuración (si la automatización está activa). */
export async function schedule(
  q: Query,
  type: AutomationType,
  ref: { orderId?: number; customerId: number; payload?: Record<string, unknown> },
) {
  const [s] = await q<Setting>("select * from automation_settings where type = $1", [type]);
  // El vencimiento libera stock: se programa aunque su mensaje esté desactivado.
  if (!s || (!s.enabled && type !== "pedido_vencido")) return;
  await q(
    `insert into automation_jobs (type, order_id, customer_id, payload, run_at)
     values ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
    [type, ref.orderId ?? null, ref.customerId, JSON.stringify(ref.payload ?? {}), s.delay_minutes],
  );
}

type Ctx = {
  customer: { id: number; phone: string; first_name: string; last_inbound_at: Date | null; accepts_marketing: boolean };
  order?: { id: number; code: string; status: OrderStatus; total_cents: number; payment_method: string; courier: string | null; tracking_number: string | null };
  perfume?: string;
  link?: string;
  /** Variables extra (p. ej. las de una cotización: {codigo}, {total}, {vence}). */
  vars?: Record<string, string>;
};

export function render(template: string, c: Ctx) {
  const vars: Record<string, string> = {
    nombre: c.customer.first_name || "",
    codigo: c.order?.code ?? "",
    total: c.order ? soles(c.order.total_cents / 100) : "",
    metodo: c.order ? (c.order.payment_method === "plin" ? "Plin" : "Yape") : "",
    agencia: c.order?.courier ?? "la agencia",
    guia: c.order?.tracking_number ?? "",
    perfume: c.perfume ?? "tu perfume",
    link: c.link ?? store.siteUrl,
    tienda: store.name,
    ...c.vars,
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m).replace(/\s+([,.!?])/g, "$1").replace(/ {2,}/g, " ");
}

async function context(job: { order_id: number | null; customer_id: number; payload: Record<string, unknown> }): Promise<Ctx> {
  const [customer] = await query<Ctx["customer"]>(
    "select id, phone, first_name, last_inbound_at, accepts_marketing from customers where id = $1",
    [job.customer_id],
  );
  let order: Ctx["order"];
  let perfume = typeof job.payload.perfume === "string" ? job.payload.perfume : undefined;
  let link = typeof job.payload.link === "string" ? job.payload.link : undefined;
  if (job.order_id) {
    [order] = await query<NonNullable<Ctx["order"]>>(
      `select id, code, status, payment_method, courier, tracking_number,
              subtotal_cents - discount_cents + coalesce(shipping_cents, 0) as total_cents
       from orders where id = $1`,
      [job.order_id],
    );
    const items = await query<{ brand: string; name: string; slug: string }>(
      `select oi.brand, oi.name, p.slug from order_items oi
       join product_variants v on v.id = oi.variant_id join products p on p.id = v.product_id
       where oi.order_id = $1 order by oi.id`,
      [job.order_id],
    );
    perfume ??= items.map((i) => `${i.brand} ${i.name}`).join(", ") || undefined;
    link ??= items[0] ? `${store.siteUrl}/perfumes/${items[0].slug}` : undefined;
  }
  const vars = job.payload.vars && typeof job.payload.vars === "object" ? (job.payload.vars as Record<string, string>) : undefined;
  return { customer, order, perfume, link, vars };
}

/** Envía ya (para mensajes inmediatos disparados por una acción del panel o del bot). */
export async function sendNow(type: AutomationType, ref: { orderId?: number; customerId: number; payload?: Record<string, unknown> }) {
  const [s] = await query<Setting>("select * from automation_settings where type = $1", [type]);
  if (!s?.enabled) return "desactivada";
  return deliver(s, await context({ order_id: ref.orderId ?? null, customer_id: ref.customerId, payload: ref.payload ?? {} }));
}

async function deliver(s: Setting, c: Ctx): Promise<string> {
  if (automationInfo[s.type].marketing && !c.customer.accepts_marketing) return "omitido: el cliente no aceptó mensajes promocionales";
  const text = render(s.template, c);
  if (inServiceWindow(c.customer.last_inbound_at)) {
    await sendText(c.customer, text, "automatizacion");
    return "enviado";
  }
  if (s.wa_template) {
    // Las plantillas de Meta usan variables {{1}}, {{2}}…: se mandan nombre, código y el dato principal.
    await sendTemplate(c.customer, s.wa_template, [c.customer.first_name || "cliente", c.order?.code ?? "", c.perfume ?? ""], text);
    return "enviado (plantilla)";
  }
  return "omitido: pasaron más de 24 h desde el último mensaje del cliente y no hay plantilla de Meta configurada";
}

/** Procesa los mensajes programados que ya vencieron. Lo llama el cron cada pocos minutos. */
export async function runDueJobs(limit = 25) {
  const jobs = await query<{ id: number; type: AutomationType; order_id: number | null; customer_id: number; payload: Record<string, unknown> }>(
    `update automation_jobs set attempts = attempts + 1
     where id in (select id from automation_jobs where status = 'pendiente' and run_at <= now() order by run_at limit $1 for update skip locked)
     returning id, type, order_id, customer_id, payload`,
    [limit],
  );
  const results: { id: number; type: string; result: string }[] = [];
  for (const job of jobs) {
    let status: "hecho" | "omitido" | "error" = "hecho";
    let result: string;
    try {
      const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
      const c = await context({ ...job, payload });
      const valid = validWhen[job.type];
      if (valid && c.order && !valid.includes(c.order.status)) {
        status = "omitido";
        result = `omitido: el pedido ya está "${c.order.status}"`;
      } else {
        if (job.type === "pedido_vencido" && c.order) await expireOrder(c.order.id);
        const [s] = await query<Setting>("select * from automation_settings where type = $1", [job.type]);
        result = s?.enabled ? await deliver(s, c) : "omitido: automatización desactivada";
        if (result.startsWith("omitido")) status = "omitido";
      }
    } catch (e) {
      status = "error";
      result = e instanceof Error ? e.message : String(e);
    }
    await query("update automation_jobs set status = $2, result = $3 where id = $1", [job.id, status, result]);
    results.push({ id: job.id, type: job.type, result });
  }
  return results;
}

/** Cancela un pedido sin pago y devuelve las unidades reservadas. */
export async function expireOrder(orderId: number) {
  await tx(async (q) => {
    const [o] = await q<{ status: OrderStatus }>("select status from orders where id = $1 for update", [orderId]);
    if (o?.status !== "pendiente_pago") return;
    await q(
      `update product_variants v set reserved = greatest(v.reserved - oi.qty, 0)
       from order_items oi where oi.order_id = $1 and oi.variant_id = v.id`,
      [orderId],
    );
    await q("update orders set status = 'vencido', reserved_until = null, updated_at = now() where id = $1", [orderId]);
  });
}
