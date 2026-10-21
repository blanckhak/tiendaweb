import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { statusLabel } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";
import { query } from "./db";
import { LOGIN_CODE, verifyLoginCode } from "./customer-auth";
import { attachReceipt } from "./orders";
import { quoteStatusLabel, type QuoteStatus } from "./quotes";
import { putFile, ALLOWED_TYPES } from "./storage";
import { searchPerfumes, searchResultJson, searchTool } from "./perfume-search";
import { notifyOwner, sendText } from "./whatsapp";

export type Inbound = {
  from: string; // teléfono del cliente, formato internacional sin "+"
  name?: string; // nombre del perfil de WhatsApp
  waId?: string; // id del mensaje en Meta (para no procesarlo dos veces)
  text?: string;
  media?: { data: Buffer; contentType: string };
  kind?: string; // text | image | document | audio | ...
};

type Customer = { id: number; phone: string; first_name: string; bot_paused: boolean };

const ORDER_CODE = /\bAUR-\d{3,}\b/i;
const QUOTE_CODE = /\bCOT-\d{3,}\b/i;

/** Tope de respuestas automáticas por cliente y hora: protege el saldo de la API de Claude. */
const MAX_BOT_REPLIES_PER_HOUR = 30;

/** Punto de entrada: guarda el mensaje del cliente y decide quién responde. */
export async function handleInbound(msg: Inbound) {
  const [customer] = await query<Customer>(
    `insert into customers (phone, first_name, last_inbound_at) values ($1, $2, now())
     on conflict (phone) do update set last_inbound_at = now(),
       first_name = case when customers.first_name = '' then excluded.first_name else customers.first_name end
     returning id, phone, first_name, bot_paused`,
    [msg.from, msg.name?.split(" ")[0] ?? ""],
  );

  let mediaKey: string | null = null;
  if (msg.media && ALLOWED_TYPES.includes(msg.media.contentType)) {
    mediaKey = await putFile("private", msg.media.data, msg.media.contentType);
  }

  const inserted = await query(
    `insert into wa_messages (customer_id, wa_id, direction, author, kind, body, media_key)
     values ($1, $2, 'in', 'cliente', $3, $4, $5) on conflict (wa_id) do nothing returning id`,
    [customer.id, msg.waId ?? null, msg.kind ?? (msg.media ? "image" : "text"), msg.text ?? "", mediaKey],
  );
  if (!inserted.length) return; // Meta reenvió un mensaje que ya procesamos

  // 1. Comprobante de pago (foto o PDF): se adjunta al pedido pendiente.
  if (mediaKey) {
    const order = await attachReceipt(customer.id, mediaKey);
    if (!order && !customer.bot_paused) {
      await sendText(
        customer,
        "Recibimos tu archivo 🙌. No encontramos un pedido pendiente a tu nombre. Si ya hiciste un pedido en la web, envíanos su código (por ejemplo AUR-1001).",
        "bot",
      );
    }
    return;
  }

  // 2a. Ingreso a la cuenta web: el cliente envía "ACCESO XXXXXX" desde su WhatsApp.
  const login = msg.text?.match(LOGIN_CODE)?.[1];
  if (login) {
    const ok = await verifyLoginCode(login, customer.id);
    await sendText(
      customer,
      ok
        ? "✅ ¡Listo! Ya puedes volver a la página: tu cuenta se abrirá sola."
        : "Ese código de acceso venció o ya se usó. Vuelve a la página y toca \"Entrar con WhatsApp\" otra vez.",
      "bot",
    );
    return;
  }

  // 2b. Cotización pedida desde la web.
  const quoteCode = msg.text?.match(QUOTE_CODE)?.[0].toUpperCase();
  if (quoteCode) {
    const [qt] = await query<{ status: QuoteStatus; customer_id: number }>("select status, customer_id from quotes where code = $1", [quoteCode]);
    if (qt && qt.customer_id === customer.id) {
      await sendText(
        customer,
        qt.status === "solicitada"
          ? `¡Gracias! Recibimos tu solicitud de cotización *${quoteCode}* 📝. Te enviamos los precios por aquí muy pronto.`
          : `Tu cotización *${quoteCode}* está: *${quoteStatusLabel[qt.status]}*. Puedes verla en ${store.siteUrl}/cuenta/cotizaciones/${quoteCode}`,
        "bot",
      );
      return;
    }
  }

  // 2c. El cliente llega desde el checkout con el código del pedido.
  const code = msg.text?.match(ORDER_CODE)?.[0].toUpperCase();
  if (code && (await replyOrderConfirmation(customer, code))) return;

  // 3. Atiende una persona: el bot no responde.
  if (customer.bot_paused) return;

  if (msg.kind && !["text", "interactive", "button"].includes(msg.kind)) {
    await sendText(customer, "Por ahora solo puedo leer texto, fotos y PDF. ¿Me lo escribes? 🙏", "bot");
    return;
  }

  const [{ recent }] = await query<{ recent: number }>(
    "select count(*)::int as recent from wa_messages where customer_id = $1 and author = 'bot' and created_at > now() - interval '1 hour'",
    [customer.id],
  );
  if (recent >= MAX_BOT_REPLIES_PER_HOUR) {
    if (recent === MAX_BOT_REPLIES_PER_HOUR) {
      await sendText(customer, "Te paso con una persona del equipo para seguir ayudándote 🙌", "bot");
      await query("update customers set bot_paused = true where id = $1", [customer.id]);
      await notifyOwner(`El cliente +${customer.phone} superó el límite de mensajes del bot. Atiéndelo desde el panel.`);
    }
    return;
  }

  const reply = aiEnabled() ? await aiReply(customer) : menuReply(msg.text ?? "");
  if (reply) await sendText(customer, reply, "bot");
}

async function replyOrderConfirmation(customer: Customer, code: string) {
  const [o] = await query<{ id: number; customer_id: number; status: OrderStatus; payment_method: "yape" | "plin"; subtotal_cents: number; shipping_cents: number | null }>(
    "select id, customer_id, status, payment_method, subtotal_cents, shipping_cents from orders where code = $1",
    [code],
  );
  if (!o) return false;
  if (o.status !== "pendiente_pago") {
    await sendText(customer, `Tu pedido *${code}* está: *${statusLabel[o.status]}*. ¿Te ayudo con algo más?`, "bot");
    return true;
  }
  const items = await query<{ qty: number; brand: string; name: string; ml: number; price_cents: number }>(
    "select qty, brand, name, ml, price_cents from order_items where order_id = $1 order by id",
    [o.id],
  );
  const pay = store.payments[o.payment_method];
  const text = [
    `¡Hola${customer.first_name ? ` ${customer.first_name}` : ""}! Recibimos tu pedido *${code}* ✅`,
    "",
    ...items.map((i) => `• ${i.qty} x ${i.brand} ${i.name} ${i.ml} ml — ${soles((i.qty * i.price_cents) / 100)}`),
    "",
    o.shipping_cents === 0
      ? `Total: *${soles(o.subtotal_cents / 100)}* con *envío gratis* 🎉`
      : `Productos: *${soles(o.subtotal_cents / 100)}*. En un momento te confirmamos el costo de envío.`,
    "",
    `Puedes pagar por *${o.payment_method === "plin" ? "Plin" : "Yape"}* a ${pay.holder} (${pay.number}) y enviarnos aquí la *captura del comprobante*.`,
    `Tu stock queda reservado ${store.reservationHours} horas.`,
  ].join("\n");
  await sendText(customer, text, "bot");
  await notifyOwner(`Nuevo pedido ${code} por ${soles(o.subtotal_cents / 100)}. Falta confirmar el envío.`);
  return true;
}

// ---------- Sin IA: menú simple ----------

function menuReply(text: string) {
  const t = text.toLowerCase();
  if (/(precio|cu[aá]nto|stock|tienen|perfume|recomi)/.test(t))
    return `Puedes ver todos los perfumes con precio y stock aquí: ${store.siteUrl}/perfumes\n¿No sabes cuál elegir? Haz el test de 1 minuto: ${store.siteUrl}/encuentra-tu-perfume`;
  if (/(env[ií]o|delivery|provincia|agencia)/.test(t))
    return "Hacemos envíos a todo el Perú 🚚. Lima por motorizado y provincias por agencia. El costo te lo confirmamos según tu distrito.";
  if (/(cotiza|mayor|por mayor|corporativ|cantidad)/.test(t))
    return `Para compras por cantidad arma tu bolsa en la web y toca "Pedir cotización": ${store.siteUrl}/cotizar
Te enviamos los precios por aquí. 📝`;
  if (/(pago|yape|plin)/.test(t))
    return `Aceptamos Yape (${store.payments.yape.number}) y Plin (${store.payments.plin.number}). Después del pago envíanos la captura por aquí.`;
  return `¡Hola! 👋 Soy el asistente de ${store.name}. Puedo ayudarte con:\n• Precios y stock: ${store.siteUrl}/perfumes\n• Recomendaciones: ${store.siteUrl}/encuentra-tu-perfume\n• Envíos y pagos\nEscribe tu consulta y te respondemos.`;
}

// ---------- Con IA (Claude) ----------

export const aiEnabled = () =>
  process.env.BOT_AI !== "off" && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export const MODEL = () => process.env.BOT_MODEL || "claude-opus-5-5";

const SYSTEM = () => `Eres el asesor de ventas por WhatsApp de ${store.name}, una tienda online de perfumes originales en Perú.

Cómo escribes:
- Español peruano, cálido y breve: 1 a 4 líneas, como un vendedor amable por WhatsApp. Emojis con moderación.
- Formato de WhatsApp: *negrita* con un asterisco. Nada de markdown con ## ni tablas.
- Haz una pregunta a la vez para entender qué busca (para quién, ocasión, aromas que le gustan, presupuesto).

Qué sabes y qué no:
- Precios, stock, notas y links de perfumes: SOLO de la herramienta buscar_perfumes. Nunca inventes perfumes, precios, stock ni descuentos.
- Estado de pedidos: SOLO de ver_mis_pedidos.
- Envíos a todo el Perú: Lima por motorizado, provincias por agencia. El costo se confirma según el distrito; no des montos de envío.
- Pagos: Yape o Plin. El cliente envía la captura del comprobante por este chat. Tú nunca confirmas pagos: lo valida una persona.
- Para comprar, comparte el link del perfume: el cliente lo agrega a la bolsa y finaliza en la web; el pedido llega a este chat.
- Compras por mayor, regalos corporativos o precio especial por cantidad: el cliente arma su bolsa en la web y toca "Pedir cotización" (${store.siteUrl}/cotizar). La respuesta con precios llega por este chat.

Pasa la conversación a una persona con pasar_a_humano cuando: el cliente lo pida, haya un reclamo o problema con un pedido, o pida algo que no puedes resolver.`;

const tools: BetaTool[] = [
  searchTool,
  {
    name: "ver_mis_pedidos",
    description: "Lista los pedidos de este cliente (código, estado, total y guía de envío si existe).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "pasar_a_humano",
    description: "Deriva la conversación a una persona del equipo. Después de usarla, despídete diciendo que alguien le escribirá pronto.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "Resumen breve de lo que necesita el cliente." } },
      required: ["motivo"],
      additionalProperties: false,
    },
  },
];

async function runTool(customer: Customer, block: BetaToolUseBlock): Promise<string> {
  const input = (block.input ?? {}) as Record<string, unknown>;
  if (block.name === "buscar_perfumes") return searchResultJson(await searchPerfumes(block.input));
  if (block.name === "ver_mis_pedidos") {
    const orders = await query<{ code: string; status: OrderStatus; total_cents: number; courier: string | null; tracking_number: string | null; created_at: Date }>(
      `select code, status, courier, tracking_number, created_at,
              subtotal_cents - discount_cents + coalesce(shipping_cents, 0) as total_cents
       from orders where customer_id = $1 order by created_at desc limit 5`,
      [customer.id],
    );
    return JSON.stringify(
      orders.length
        ? orders.map((o) => ({ codigo: o.code, estado: statusLabel[o.status], total: soles(o.total_cents / 100), agencia: o.courier, guia: o.tracking_number }))
        : { resultado: "Este cliente no tiene pedidos." },
    );
  }
  if (block.name === "pasar_a_humano") {
    const motivo = typeof input.motivo === "string" ? input.motivo.slice(0, 300) : "Sin detalle";
    await query("update customers set bot_paused = true where id = $1", [customer.id]);
    await notifyOwner(`Un cliente (+${customer.phone}) pide atención: ${motivo}`);
    return JSON.stringify({ ok: true, nota: "Conversación derivada. El bot dejará de responder a este cliente." });
  }
  return JSON.stringify({ error: `Herramienta desconocida: ${block.name}` });
}

/** Historial reciente del chat como mensajes para Claude (solo texto, roles alternados). */
async function history(customerId: number): Promise<BetaMessageParam[]> {
  const rows = await query<{ direction: "in" | "out"; body: string; kind: string; author: string }>(
    `select direction, body, kind, author from (
       select direction, body, kind, author, id from wa_messages
       where customer_id = $1 and status <> 'error' order by id desc limit 20
     ) t order by id`,
    [customerId],
  );
  const out: BetaMessageParam[] = [];
  for (const r of rows) {
    const role = r.direction === "in" ? "user" : "assistant";
    const body = r.body || (r.kind === "image" ? "[foto]" : `[${r.kind}]`);
    const text = r.direction === "out" && r.author !== "bot" ? `[mensaje enviado por ${r.author === "humano" ? "el equipo" : "el sistema"}] ${body}` : body;
    const last = out.at(-1);
    if (last?.role === role) last.content = `${last.content}\n${text}`;
    else out.push({ role, content: text });
  }
  while (out[0]?.role === "assistant") out.shift(); // debe empezar con el cliente
  return out;
}

let client: Anthropic | null = null;

async function aiReply(customer: Customer): Promise<string | null> {
  client ??= new Anthropic();
  const messages = await history(customer.id);
  if (!messages.length || messages.at(-1)!.role !== "user") return null;

  try {
    for (let turn = 0; turn < 6; turn++) {
      const res = await client.beta.messages.create({
        model: MODEL(),
        max_tokens: 2000,
        system: SYSTEM(),
        tools,
        messages,
        // Chat de ventas: respuestas rápidas y breves.
        output_config: { effort: "low" },
        // Si el modelo declina una respuesta, el servidor reintenta con otro modelo.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      if (res.stop_reason === "refusal") return "Disculpa, en eso no puedo ayudarte. ¿Te ayudo a encontrar un perfume? 😊";

      const toolUses = res.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !toolUses.length) {
        const text = res.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n")
          .trim();
        return text || null;
      }

      messages.push({ role: "assistant", content: res.content });
      const results: BetaToolResultBlockParam[] = [];
      for (const t of toolUses) {
        try {
          results.push({ type: "tool_result", tool_use_id: t.id, content: await runTool(customer, t) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: t.id, content: e instanceof Error ? e.message : String(e), is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return null;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.error("[bot] límite de uso de la API de Claude", e.message);
    else if (e instanceof Anthropic.AuthenticationError) console.error("[bot] clave de la API de Claude inválida");
    else if (e instanceof Anthropic.APIError) console.error(`[bot] error de la API de Claude ${e.status}:`, e.message);
    else console.error("[bot] error", e);
    // Si la IA falla, el cliente igual recibe una respuesta útil.
    const lastUser = messages.at(-1);
    return menuReply(typeof lastUser?.content === "string" ? lastUser.content : "");
  }
}
