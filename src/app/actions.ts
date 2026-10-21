"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { PRODUCTS_TAG } from "@/server/catalog";
import { currentCustomerId } from "@/server/customer-auth";
import { query } from "@/server/db";
import { createOrder, OrderError, type CreatedOrder, type OrderInput } from "@/server/orders";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createOrderAction(input: OrderInput): Promise<ActionResult<CreatedOrder>> {
  // Para confirmar un pedido hay que tener cuenta con WhatsApp verificado.
  const customerId = await currentCustomerId();
  if (!customerId) return { ok: false, error: "Inicia sesión o crea tu cuenta para confirmar el pedido." };
  const [c] = await query<{ phone: string | null }>("select phone from customers where id = $1", [customerId]);
  if (!c) return { ok: false, error: "Inicia sesión o crea tu cuenta para confirmar el pedido." };
  if (!c.phone) return { ok: false, error: "Vincula tu WhatsApp para confirmar el pedido." };
  try {
    // El pedido siempre va al número verificado de la cuenta, nunca al que venga del navegador.
    const order = await createOrder({ ...input, phone: c.phone });
    updateTag(PRODUCTS_TAG); // cambió el stock disponible
    return { ok: true, data: order };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos del formulario." };
    console.error("[checkout]", e);
    return { ok: false, error: "No pudimos registrar tu pedido. Inténtalo de nuevo o escríbenos por WhatsApp." };
  }
}

/** "Avísame cuando llegue": guarda el teléfono para avisar por WhatsApp al reponer stock. */
export async function stockAlertAction(variantId: number, phoneInput: string): Promise<ActionResult<null>> {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { ok: false, error: "Número de WhatsApp inválido." };
  if (!Number.isInteger(variantId) || variantId <= 0) return { ok: false, error: "Producto inválido." };
  const [v] = await query("select id from product_variants where id = $1", [variantId]);
  if (!v) return { ok: false, error: "Producto inválido." };
  const [c] = await query<{ id: number }>(
    "insert into customers (phone) values ($1) on conflict (phone) do update set phone = excluded.phone returning id",
    [phone],
  );
  await query("insert into stock_alerts (variant_id, customer_id) values ($1, $2) on conflict do nothing", [variantId, c.id]);
  return { ok: true, data: null };
}

export async function newsletterAction(email: string): Promise<ActionResult<null>> {
  const parsed = z.email().max(120).safeParse(email.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Correo inválido." };
  await query("insert into newsletter (email) values ($1) on conflict do nothing", [parsed.data]);
  return { ok: true, data: null };
}

/** Seguimiento sin cuenta: código del pedido + 4 últimos dígitos del WhatsApp. */
export async function trackOrderAction(code: string, last4: string): Promise<ActionResult<import("@/server/tracking").TrackedOrder>> {
  const { trackOrder, tooManyAttempts } = await import("@/server/tracking");
  const { headers } = await import("next/headers");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  if (tooManyAttempts(ip)) return { ok: false, error: "Demasiados intentos. Espera unos minutos." };
  const order = await trackOrder(String(code ?? ""), String(last4 ?? "").replace(/\D/g, ""));
  if (!order) return { ok: false, error: "No encontramos un pedido con esos datos. Revisa el código y los 4 últimos dígitos de tu WhatsApp." };
  return { ok: true, data: order };
}

/** Libro de Reclamaciones: registra la hoja y devuelve la constancia. */
export async function complaintAction(
  input: import("@/server/complaints").ComplaintInput,
): Promise<ActionResult<{ code: string; html: string; emailed: boolean; due: string }>> {
  const { createComplaint, complaintHtml } = await import("@/server/complaints");
  try {
    const { complaint, emailed } = await createComplaint(input);
    return {
      ok: true,
      data: {
        code: complaint.code,
        html: complaintHtml(complaint),
        emailed,
        due: new Date(complaint.due_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" }),
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos." };
    console.error("[reclamaciones]", e);
    return { ok: false, error: "No pudimos registrar tu hoja. Inténtalo de nuevo o escríbenos por WhatsApp." };
  }
}

/** Asesor de perfumes con IA: recibe la conversación del navegador y devuelve la respuesta. */
export async function assistantAction(
  turns: import("@/server/assistant").ChatTurn[],
): Promise<ActionResult<import("@/server/assistant").AssistantReply>> {
  const { askAssistant, chatInput, tooManyQuestions } = await import("@/server/assistant");
  const { getStoreSettings } = await import("@/server/settings");
  const { headers } = await import("next/headers");
  if (!(await getStoreSettings()).assistantEnabled) return { ok: false, error: "El asesor no está disponible." };
  const parsed = chatInput.safeParse(turns);
  if (!parsed.success) return { ok: false, error: "No pude leer tu mensaje. Escríbelo de nuevo, por favor." };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  if (await tooManyQuestions(ip))
    return { ok: false, error: "Hiciste muchas preguntas seguidas. Espera un rato o escríbenos por WhatsApp." };
  return { ok: true, data: await askAssistant(parsed.data) };
}
