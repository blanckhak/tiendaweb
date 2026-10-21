"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import type { AutomationType } from "@/server/automations";
import { runDueJobs, sendNow } from "@/server/automations";
import { checkEmail, checkPassword, newSessionToken, requireAdmin, SESSION_COOKIE } from "@/server/auth";
import { handleInbound } from "@/server/bot";
import { PRODUCTS_TAG } from "@/server/catalog";
import { query, tx } from "@/server/db";
import {
  approvePayment,
  cancelOrder,
  deliverOrder,
  markPreparing,
  OrderError,
  rejectPayment,
  setShipping,
  shipOrder,
} from "@/server/orders";
import { saveStoreSettings, SETTINGS_TAG } from "@/server/settings";
import { ALLOWED_TYPES, putFile } from "@/server/storage";
import { sendText } from "@/server/whatsapp";

export type FormState = { error?: string; ok?: string } | null;

const fail = (e: unknown): FormState => {
  if (e instanceof OrderError) return { error: e.message };
  if (e instanceof z.ZodError) return { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") };
  console.error("[admin]", e);
  return { error: "Ocurrió un error. Revisa los datos e inténtalo de nuevo." };
};

// ---------- Sesión ----------

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = form.get("email")?.toString() ?? "";
  const password = form.get("password")?.toString() ?? "";
  // Se revisan ambos siempre y el error no dice cuál falló.
  const ok = checkPassword(password) && checkEmail(email);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // frena intentos de adivinar
    return { error: "Correo o contraseña incorrectos." };
  }
  const { token, expires } = newSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- Pedidos ----------

const orderId = (form: FormData) => z.coerce.number().int().positive().parse(form.get("orderId"));

export async function orderAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const id = orderId(form);
    const op = form.get("op");
    switch (op) {
      case "aprobar":
        await approvePayment(id);
        break;
      case "rechazar":
        await rejectPayment(id);
        break;
      case "preparar":
        await markPreparing(id);
        break;
      case "despachar": {
        const courier = z.string().trim().min(2, "Indica la agencia").max(60).parse(form.get("courier"));
        const tracking = z.string().trim().min(2, "Indica el número de guía").max(60).parse(form.get("tracking"));
        await shipOrder(id, courier, tracking);
        break;
      }
      case "entregar":
        await deliverOrder(id);
        break;
      case "cancelar":
        await cancelOrder(id);
        break;
      case "envio": {
        const soles = z.coerce.number().min(0).max(1000).parse(form.get("shipping"));
        await setShipping(id, Math.round(soles * 100));
        break;
      }
      default:
        return { error: "Acción desconocida." };
    }
    updateTag(PRODUCTS_TAG); // aprobar, cancelar o vencer cambian el stock visible
    refresh();
    return { ok: "Listo." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Productos ----------

const lines = (v: FormDataEntryValue | null) =>
  (v?.toString() ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");

const productSchema = z.object({
  id: z.coerce.number().int().optional(),
  brand: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  gender: z.enum(["Hombre", "Mujer", "Unisex"]),
  family: z.string().trim().min(1).max(40),
  description: z.string().trim().max(1000),
  featured: z.boolean(),
  isNew: z.boolean(),
  active: z.boolean(),
  colors: z.object({ glass: color, cap: color, liquid: color }),
  variants: z
    .array(
      z.object({
        id: z.coerce.number().int().optional(),
        ml: z.coerce.number().int().min(1).max(1000),
        sku: z.string().trim().min(2).max(40),
        price: z.coerce.number().min(0).max(100000),
        compareAt: z.coerce.number().min(0).max(100000).optional(),
        stock: z.coerce.number().int().min(0).max(100000),
      }),
    )
    .min(1, "Agrega al menos una presentación"),
});

const slugify = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function saveProductAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  let savedId: number;
  try {
    const n = Number(form.get("variantCount") ?? 0);
    const variants = Array.from({ length: n }, (_, i) => ({
      id: form.get(`v${i}.id`) || undefined,
      ml: form.get(`v${i}.ml`),
      sku: form.get(`v${i}.sku`),
      price: form.get(`v${i}.price`),
      compareAt: form.get(`v${i}.compareAt`) || undefined,
      stock: form.get(`v${i}.stock`),
    })).filter((v) => v.ml || v.sku);
    const p = productSchema.parse({
      id: form.get("id") || undefined,
      brand: form.get("brand"),
      name: form.get("name"),
      gender: form.get("gender"),
      family: form.get("family"),
      description: form.get("description") ?? "",
      featured: form.get("featured") === "on",
      isNew: form.get("isNew") === "on",
      active: form.get("active") === "on",
      colors: { glass: form.get("glass"), cap: form.get("cap"), liquid: form.get("liquid") },
      variants,
    });

    let imageKey: string | undefined;
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      if (!ALLOWED_TYPES.includes(image.type) || image.type === "application/pdf") return { error: "La foto debe ser JPG, PNG o WebP." };
      if (image.size > 4 * 1024 * 1024) return { error: "La foto pesa más de 4 MB." };
      imageKey = await putFile("public", Buffer.from(await image.arrayBuffer()), image.type);
    }

    const restocked: number[] = [];
    savedId = await tx(async (q) => {
      const notes = [lines(form.get("notesTop")), lines(form.get("notesHeart")), lines(form.get("notesBase"))];
      let id = p.id;
      if (id) {
        await q(
          `update products set brand=$2, name=$3, gender=$4, family=$5, description=$6, notes_top=$7, notes_heart=$8, notes_base=$9,
             featured=$10, is_new=$11, active=$12, colors=$13, image_key=coalesce($14, image_key) where id=$1`,
          [id, p.brand, p.name, p.gender, p.family, p.description, ...notes, p.featured, p.isNew, p.active, JSON.stringify(p.colors), imageKey ?? null],
        );
      } else {
        let slug = slugify(`${p.brand} ${p.name}`);
        const [taken] = await q("select 1 from products where slug = $1", [slug]);
        if (taken) slug = `${slug}-${Date.now().toString(36)}`;
        [{ id }] = await q<{ id: number }>(
          `insert into products (slug, brand, name, gender, family, description, notes_top, notes_heart, notes_base, featured, is_new, active, colors, image_key)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
          [slug, p.brand, p.name, p.gender, p.family, p.description, ...notes, p.featured, p.isNew, p.active, JSON.stringify(p.colors), imageKey ?? null],
        );
      }
      for (const v of p.variants) {
        const price = Math.round(v.price * 100);
        const compare = v.compareAt ? Math.round(v.compareAt * 100) : null;
        if (v.id) {
          const [before] = await q<{ available: number }>(
            "select (stock - reserved)::int as available from product_variants where id = $1 and product_id = $2",
            [v.id, id],
          );
          await q(
            "update product_variants set ml=$3, sku=$4, price_cents=$5, compare_at_cents=$6, stock=$7 where id=$1 and product_id=$2",
            [v.id, id, v.ml, v.sku, price, compare, v.stock],
          );
          const [after] = await q<{ available: number }>("select (stock - reserved)::int as available from product_variants where id = $1", [v.id]);
          if (before?.available === 0 && after.available > 0) restocked.push(v.id);
        } else {
          await q(
            "insert into product_variants (product_id, ml, sku, price_cents, compare_at_cents, stock) values ($1,$2,$3,$4,$5,$6)",
            [id, v.ml, v.sku, price, compare, v.stock],
          );
        }
      }
      return id!;
    });

    // Avisa a quienes pidieron "avísame cuando llegue".
    for (const variantId of restocked) {
      const alerts = await query<{ id: number; customer_id: number; label: string; slug: string }>(
        `select a.id, a.customer_id, p.brand || ' ' || p.name || ' ' || v.ml || ' ml' as label, p.slug
         from stock_alerts a join product_variants v on v.id = a.variant_id join products p on p.id = v.product_id
         where a.variant_id = $1 and a.notified_at is null`,
        [variantId],
      );
      for (const a of alerts) {
        const { store } = await import("@/lib/config");
        await sendNow("stock_repuesto", { customerId: a.customer_id, payload: { perfume: a.label, link: `${store.siteUrl}/perfumes/${a.slug}` } });
        await query("update stock_alerts set notified_at = now() where id = $1", [a.id]);
      }
    }
    updateTag(PRODUCTS_TAG);
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/productos/${savedId}?guardado=1`);
}

export async function deleteVariantAction(form: FormData) {
  await requireAdmin();
  const id = z.coerce.number().int().parse(form.get("variantId"));
  const [used] = await query("select 1 from order_items where variant_id = $1 limit 1", [id]);
  // Si ya se vendió, se deja en stock 0 para conservar el historial de pedidos.
  if (used) await query("update product_variants set stock = reserved where id = $1", [id]);
  else await query("delete from product_variants where id = $1", [id]);
  updateTag(PRODUCTS_TAG);
  refresh();
}

// ---------- Chats ----------

export async function replyAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const customerId = z.coerce.number().int().parse(form.get("customerId"));
    const text = z.string().trim().min(1, "Escribe un mensaje").max(4000).parse(form.get("text"));
    const [c] = await query<{ id: number; phone: string }>("select id, phone from customers where id = $1", [customerId]);
    if (!c) return { error: "Cliente no encontrado." };
    await sendText(c, text, "humano");
    refresh();
    return { ok: "Enviado." };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleBotAction(form: FormData) {
  await requireAdmin();
  const customerId = z.coerce.number().int().parse(form.get("customerId"));
  await query("update customers set bot_paused = not bot_paused where id = $1", [customerId]);
  refresh();
}

// ---------- Automatizaciones ----------

export async function saveAutomationAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const type = z.string().parse(form.get("type")) as AutomationType;
    const template = z.string().trim().min(5).max(1000).parse(form.get("template"));
    const delay = z.coerce.number().int().min(0).max(365 * 24 * 60).parse(form.get("delay"));
    const waTemplate = z.string().trim().max(100).parse(form.get("waTemplate") ?? "");
    await query(
      "update automation_settings set enabled = $2, template = $3, delay_minutes = $4, wa_template = $5 where type = $1",
      [type, form.get("enabled") === "on", template, delay, waTemplate || null],
    );
    refresh();
    return { ok: "Guardado." };
  } catch (e) {
    return fail(e);
  }
}

export async function runJobsAction(): Promise<FormState> {
  await requireAdmin();
  const results = await runDueJobs();
  updateTag(PRODUCTS_TAG);
  refresh();
  return { ok: results.length ? `${results.length} mensajes procesados.` : "No había mensajes pendientes." };
}

// ---------- Simulador de WhatsApp (pruebas sin Meta) ----------

export async function simulateAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const phone = normalizePhone(form.get("phone")?.toString() ?? "");
    if (!phone) return { error: "Teléfono inválido." };
    const text = form.get("text")?.toString().trim() ?? "";
    const file = form.get("file");
    const media =
      file instanceof File && file.size > 0
        ? { data: Buffer.from(await file.arrayBuffer()), contentType: file.type }
        : undefined;
    if (!text && !media) return { error: "Escribe un mensaje o adjunta una imagen." };
    if (media && !ALLOWED_TYPES.includes(media.contentType)) return { error: "Solo JPG, PNG, WebP o PDF." };
    await handleInbound({
      from: phone,
      name: form.get("name")?.toString() || undefined,
      waId: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: text || undefined,
      media,
      kind: media ? "image" : "text",
    });
    updateTag(PRODUCTS_TAG);
    refresh();
    return { ok: "Mensaje procesado." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Cotizaciones ----------

export async function sendQuoteAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const { sendQuote } = await import("@/server/quotes");
    const quoteId = z.coerce.number().int().positive().parse(form.get("quoteId"));
    const prices: Record<string, FormDataEntryValue> = {};
    for (const [k, v] of form.entries()) if (k.startsWith("price.")) prices[k.slice("price.".length)] = v;
    const result = await sendQuote(quoteId, {
      prices: prices as Record<string, string>,
      discount: form.get("discount")?.toString() || 0,
      shipping: form.get("shipping")?.toString() ?? "",
      validDays: form.get("validDays")?.toString() || 7,
      note: form.get("note")?.toString() ?? "",
    });
    refresh();
    return { ok: result === "enviado" || result.startsWith("enviado") ? "Cotización enviada por WhatsApp." : `Guardada. WhatsApp: ${result}` };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectQuoteAdminAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const { rejectQuote } = await import("@/server/quotes");
    await rejectQuote(z.coerce.number().int().positive().parse(form.get("quoteId")));
    refresh();
    return { ok: "Cotización rechazada." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Reseñas ----------

export async function moderateReviewAction(form: FormData) {
  await requireAdmin();
  const { moderateReview } = await import("@/server/reviews");
  const id = z.coerce.number().int().positive().parse(form.get("reviewId"));
  const status = z.enum(["aprobada", "rechazada"]).parse(form.get("status"));
  await moderateReview(id, status);
  updateTag(PRODUCTS_TAG); // cambia el promedio de estrellas en la tienda
  refresh();
}

// ---------- Libro de Reclamaciones ----------

export async function respondComplaintAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const { respondComplaint } = await import("@/server/complaints");
    const r = await respondComplaint(String(form.get("code") ?? ""), String(form.get("response") ?? ""));
    refresh();
    return {
      ok: r.emailed
        ? "Respuesta registrada y enviada por correo al consumidor."
        : r.emailConfigured
          ? "Respuesta registrada, pero el correo falló. Envíala manualmente."
          : "Respuesta registrada. El correo no está configurado: envíala manualmente al consumidor.",
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Ajustes de la tienda ----------

export async function saveSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const whatsappNumber = normalizePhone(form.get("whatsappNumber")?.toString() ?? "");
  if (!whatsappNumber) return { error: "Número de WhatsApp inválido. Ej.: 987654321 o 51987654321." };
  try {
    await saveStoreSettings({ whatsappNumber, assistantEnabled: form.get("assistantEnabled") === "on" });
    updateTag(SETTINGS_TAG); // la tienda usa el número nuevo desde la próxima visita
    return { ok: "Guardado. Los nuevos pedidos se enviarán a este número." };
  } catch (e) {
    return fail(e);
  }
}
