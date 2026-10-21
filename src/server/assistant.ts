import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaToolResultBlockParam, BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { aiEnabled, MODEL } from "./bot";
import { query } from "./db";
import { searchPerfumes, searchResultJson, searchTool, type SearchResult } from "./perfume-search";

// Asesor de perfumes de la tienda web. Usa la misma búsqueda del catálogo que el bot de WhatsApp,
// pero no ve pedidos ni datos de clientes: es anónimo y solo recomienda.

export const chatInput = z
  .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(800) }))
  .min(1)
  .max(20)
  .refine((m) => m[0].role === "user" && m.at(-1)!.role === "user", "La conversación debe empezar y terminar con el cliente.");

export type ChatTurn = z.infer<typeof chatInput>[number];
export type AssistantReply = { text: string; slugs: string[] };

/** Preguntas por IP y hora: protege el saldo de la API de Claude. */
const MAX_PER_HOUR = 20;

export async function tooManyQuestions(ip: string) {
  const [{ recent }] = await query<{ recent: number }>(
    "select count(*)::int as recent from assistant_requests where ip = $1 and created_at > now() - interval '1 hour'",
    [ip],
  );
  if (recent >= MAX_PER_HOUR) return true;
  await query("insert into assistant_requests (ip) values ($1)", [ip]);
  if (Math.random() < 0.02) await query("delete from assistant_requests where created_at < now() - interval '1 day'");
  return false;
}

const SYSTEM = () => `Eres el asesor de perfumes de la tienda web de ${store.name}: perfumes 100% originales en Perú.

Tu trabajo es recomendar fragancias del catálogo según lo que el cliente busca: notas que le gustan, ocasión (oficina, cita, fiesta, día, noche), clima, para quién es y presupuesto. También resuelves dudas comunes de la tienda.

Cómo escribes:
- Español peruano, cálido y breve: 2 a 5 líneas. Texto simple, sin markdown, sin asteriscos ni tablas.
- Si te falta información clave para recomendar, haz UNA pregunta corta. Si ya puedes recomendar, recomienda.
- Recomienda de 1 a 3 perfumes. Nómbralos con marca y nombre exactos (ej. "Lattafa Asad") y di en una frase por qué encaja (sus notas, la ocasión). La web muestra debajo de tu respuesta la tarjeta de cada perfume que nombres, así que no pegues links.
- Explica notas de salida, corazón y fondo con palabras sencillas cuando ayude.

Qué sabes y qué no:
- Perfumes, precios, ofertas, stock y notas: SOLO de la herramienta buscar_perfumes. Nunca inventes perfumes, precios, stock ni descuentos. No recomiendes perfumes agotados.
- Comprar: el cliente agrega el perfume a la bolsa y toca "Finalizar pedido"; se abre WhatsApp con el pedido listo para enviar.
- Pagos: Yape o Plin, después de confirmar el pedido por WhatsApp. No se paga con tarjeta en la web.
- Envíos a todo el Perú: Lima por motorizado, provincias por agencia. El costo se confirma por WhatsApp según el distrito.${
  store.freeShipping.from > 0
    ? ` Envío gratis desde ${soles(store.freeShipping.from)} a domicilio en ${store.freeShipping.zones.join(" y ")}.`
    : ""
}
- Estado de un pedido: en ${store.siteUrl}/seguimiento con el código del pedido. No puedes ver pedidos.
- Compras por cantidad o regalos corporativos: "Pedir cotización" en ${store.siteUrl}/cotizar.
- Reclamos, cambios, pagos o algo que no puedas resolver: que escriban al WhatsApp de la tienda (botón verde de la página).
- Si preguntan algo ajeno a perfumes o a la tienda, responde con amabilidad que solo puedes ayudar con perfumes.`;

let client: Anthropic | null = null;

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Perfumes encontrados que se nombran en el texto final, en el orden en que aparecen. */
function mentioned(text: string, found: Map<string, SearchResult>) {
  const t = norm(text);
  return [...found.values()]
    .map((r) => ({ slug: r.slug, at: t.indexOf(norm(r.perfume)) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.slug)
    .slice(0, 3);
}

export async function askAssistant(turns: ChatTurn[]): Promise<AssistantReply> {
  const last = turns.at(-1)!.text;
  if (!aiEnabled()) return simpleReply(last);
  client ??= new Anthropic();
  const messages: BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.text }));
  const found = new Map<string, SearchResult>();

  try {
    for (let turn = 0; turn < 5; turn++) {
      const res = await client.beta.messages.create({
        model: MODEL(),
        max_tokens: 4000,
        system: SYSTEM(),
        tools: [searchTool],
        messages,
        // Chat de tienda: respuestas rápidas y breves.
        output_config: { effort: "low" },
        // Si el modelo declina una respuesta, el servidor reintenta con otro modelo.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      if (res.stop_reason === "refusal") return { text: "Disculpa, en eso no puedo ayudarte. ¿Te ayudo a encontrar un perfume?", slugs: [] };

      const toolUses = res.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !toolUses.length) {
        const text = res.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n")
          .trim();
        return text ? { text, slugs: mentioned(text, found) } : simpleReply(last);
      }

      // Se devuelve el contenido completo (incluye el razonamiento) para que el historial quede intacto.
      messages.push({ role: "assistant", content: res.content });
      const results: BetaToolResultBlockParam[] = [];
      for (const t of toolUses) {
        if (t.name !== searchTool.name) {
          results.push({ type: "tool_result", tool_use_id: t.id, content: `Herramienta desconocida: ${t.name}`, is_error: true });
          continue;
        }
        const r = await searchPerfumes(t.input);
        r.forEach((x) => found.set(x.slug, x));
        results.push({ type: "tool_result", tool_use_id: t.id, content: searchResultJson(r) });
      }
      messages.push({ role: "user", content: results });
    }
    return simpleReply(last);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.error("[asesor] límite de uso de la API de Claude", e.message);
    else if (e instanceof Anthropic.AuthenticationError) console.error("[asesor] clave de la API de Claude inválida");
    else if (e instanceof Anthropic.APIError) console.error(`[asesor] error de la API de Claude ${e.status}:`, e.message);
    else console.error("[asesor] error", e);
    // Si la IA falla, el cliente igual recibe una respuesta útil.
    return simpleReply(last);
  }
}

// ---------- Sin IA: búsqueda por palabras ----------

/** Palabras de ocasión o estilo → familias olfativas que suelen encajar. */
const HINTS: [RegExp, string[]][] = [
  [/(dia|oficina|trabajo|universidad|verano|calor|fresc)/, ["Cítrico", "Acuático"]],
  [/(noche|cita|fiesta|salida|evento|invierno|intens|seduc)/, ["Oriental", "Especiado", "Amaderado"]],
  [/(dulce|vainilla|gourmand|caramelo)/, ["Oriental", "Frutal"]],
  [/(flor|floral|rosa|jazmin)/, ["Floral"]],
];

/** Respuesta sin IA: busca por notas, familias, ocasión, género y presupuesto con las palabras del cliente. */
export async function simpleReply(text: string): Promise<AssistantReply> {
  const t = norm(text);
  if (/(envio|delivery|provincia|agencia)/.test(t))
    return { text: "Hacemos envíos a todo el Perú: Lima por motorizado y provincias por agencia. El costo te lo confirmamos por WhatsApp según tu distrito.", slugs: [] };
  if (/(pago|yape|plin|tarjeta)/.test(t))
    return { text: 'Pagas con Yape o Plin después de confirmar tu pedido por WhatsApp. Agrega tus perfumes a la bolsa y toca "Finalizar pedido".', slugs: [] };

  const genero = /(ella|mujer|novia|mama|esposa)/.test(t) ? "Mujer" : /(\bel\b|hombre|novio|papa|esposo)/.test(t) ? "Hombre" : undefined;
  const max = Number(t.match(/(?:s\/\s*|hasta\s+)(\d{2,4})/)?.[1]) || undefined;
  const families = HINTS.filter(([re]) => re.test(t)).flatMap(([, f]) => f);
  const words = t.split(/[^a-zñ]+/).filter((w) => w.length >= 4);

  const pool = await searchPerfumes({ genero, precio_max: max }, Infinity);
  const score = new Map(pool.map((r) => [r.slug, families.includes(r.familia) ? 2 : 0]));
  for (const w of words)
    for (const r of pool) if (norm(`${r.perfume} ${r.familia} ${r.notas}`).includes(w)) score.set(r.slug, score.get(r.slug)! + 1);
  const best = pool
    .filter((r) => r.hay_stock && score.get(r.slug)! > 0)
    .sort((a, b) => score.get(b.slug)! - score.get(a.slug)!)
    .slice(0, 3);

  if (!best.length)
    return {
      text: 'Cuéntame qué aromas te gustan (fresco, dulce, floral, amaderado), para qué ocasión es y tu presupuesto, y te sugiero perfumes. También puedes hacer el test de 1 minuto en "Encuentra tu perfume".',
      slugs: [],
    };
  return { text: "Estos perfumes van con lo que buscas. Toca uno para ver sus notas y presentaciones:", slugs: best.map((r) => r.slug) };
}
