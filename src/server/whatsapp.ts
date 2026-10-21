import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "./db";

/**
 * Cliente de WhatsApp Cloud API (Meta).
 * Sin WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID funciona en modo simulado:
 * los mensajes se guardan con estado "simulado" y se ven en el panel, pero no salen.
 */
const cfg = () => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
  return token && phoneId ? { token, phoneId, base: `https://graph.facebook.com/${version}` } : null;
};

export const whatsappLive = () => cfg() !== null;

type Author = "bot" | "humano" | "automatizacion";

async function record(customerId: number, author: Author, body: string, status: string, error?: string, waId?: string, kind = "text") {
  await query(
    `insert into wa_messages (customer_id, direction, author, kind, body, status, error, wa_id) values ($1, 'out', $2, $3, $4, $5, $6, $7)`,
    [customerId, author, kind, body, status, error ?? null, waId ?? null],
  );
}

async function post(payload: object): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const c = cfg()!;
  try {
    const res = await fetch(`${c.base}/${c.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, id: json.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Mensaje de texto libre. Solo llega si el cliente escribió en las últimas 24 h (regla de Meta). */
export async function sendText(customer: { id: number; phone: string }, body: string, author: Author) {
  if (!cfg()) return record(customer.id, author, body, "simulado");
  const r = await post({ to: customer.phone, type: "text", text: { body, preview_url: true } });
  return r.ok ? record(customer.id, author, body, "enviado", undefined, r.id) : record(customer.id, author, body, "error", r.error);
}

/** Plantilla aprobada por Meta, para escribir fuera de la ventana de 24 h. */
export async function sendTemplate(
  customer: { id: number; phone: string },
  name: string,
  params: string[],
  preview: string,
) {
  if (!cfg()) return record(customer.id, "automatizacion", preview, "simulado", undefined, undefined, "template");
  const r = await post({
    to: customer.phone,
    type: "template",
    template: {
      name,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
      components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [],
    },
  });
  return r.ok
    ? record(customer.id, "automatizacion", preview, "enviado", undefined, r.id, "template")
    : record(customer.id, "automatizacion", preview, "error", r.error, undefined, "template");
}

/** Descarga una imagen o documento que mandó el cliente. */
export async function downloadMedia(mediaId: string): Promise<{ data: Buffer; contentType: string } | null> {
  const c = cfg();
  if (!c) return null;
  const meta = await fetch(`${c.base}/${mediaId}`, { headers: { Authorization: `Bearer ${c.token}` } });
  if (!meta.ok) return null;
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
  const file = await fetch(url, { headers: { Authorization: `Bearer ${c.token}` } });
  if (!file.ok) return null;
  return { data: Buffer.from(await file.arrayBuffer()), contentType: mime_type.split(";")[0] };
}

/** Verifica la firma X-Hub-Signature-256 que Meta pone en cada webhook. */
export function verifySignature(rawBody: string, header: string | null, secret = process.env.WHATSAPP_APP_SECRET) {
  // Sin secreto solo se aceptan mensajes en desarrollo y en modo simulado.
  // En producción siempre se exige la firma: si no, cualquiera podría inyectar mensajes falsos.
  if (!secret) return !cfg() && process.env.NODE_ENV !== "production";
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const got = Buffer.from(header.slice("sha256=".length), "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** ¿Podemos mandar texto libre? (el cliente escribió hace menos de 24 h) */
export function inServiceWindow(lastInboundAt: Date | null) {
  return !!lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000;
}

/** Aviso al dueño (pago recibido, stock bajo, cliente pide humano). */
export async function notifyOwner(text: string) {
  const owner = process.env.OWNER_WHATSAPP;
  if (!owner) return;
  const [c] = await query<{ id: number; phone: string }>(
    `insert into customers (phone, first_name) values ($1, 'Dueño') on conflict (phone) do update set phone = excluded.phone returning id, phone`,
    [owner],
  );
  await sendText(c, `🔔 ${text}`, "automatizacion");
}
