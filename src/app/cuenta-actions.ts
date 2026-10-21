"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { departamentos, store } from "@/lib/config";
import { PRODUCTS_TAG } from "@/server/catalog";
import { currentCustomerId, finishLogin, logoutCustomer, setCustomerSession, startLogin } from "@/server/customer-auth";
import { AuthError, loginWithPassword, registerWithPassword, setPassword } from "@/server/passwords";
import { query } from "@/server/db";
import { OrderError, type CreatedOrder } from "@/server/orders";
import { googleEnabled } from "@/server/google";
import { acceptQuote, getQuote, rejectQuote, requestQuote } from "@/server/quotes";
import { getStoreSettings } from "@/server/settings";
import { waLink } from "@/lib/wa-link";
import type { ActionResult } from "./actions";

/** Chat con el número de pedidos configurado en el panel. */
const wa = async (text: string) => waLink((await getStoreSettings()).whatsappNumber, text);

const fail = (e: unknown): { ok: false; error: string } => {
  if (e instanceof OrderError || e instanceof AuthError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos." };
  console.error("[cuenta]", e);
  return { ok: false, error: "Algo salió mal. Inténtalo de nuevo o escríbenos por WhatsApp." };
};

// ---------- Ingreso con WhatsApp ----------

export async function startLoginAction(opts: { link?: boolean } = {}): Promise<ActionResult<{ code: string; url: string }>> {
  // Vincular: la cuenta abierta (con Google) recibe el WhatsApp que se verifique.
  let linkTo: number | undefined;
  if (opts.link) {
    const id = await currentCustomerId();
    if (!id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
    const [c] = await query<{ phone: string | null }>("select phone from customers where id = $1", [id]);
    if (c?.phone) return { ok: false, error: "Tu cuenta ya tiene un WhatsApp vinculado." };
    linkTo = id;
  }
  const { code } = await startLogin(linkTo);
  // Va siempre al número conectado a Meta (.env): es el único donde el bot puede verificar el código.
  return { ok: true, data: { code, url: waLink(store.whatsapp, `ACCESO ${code}\n(Envía este mensaje para entrar a tu cuenta de ${store.name})`) } };
}

export async function finishLoginAction() {
  return finishLogin();
}

// ---------- Correo y contraseña ----------

/** Devuelve si la cuenta ya tiene WhatsApp vinculado (si no, hay que vincularlo antes de comprar). */
export async function passwordLoginAction(input: { email: string; password: string }): Promise<ActionResult<{ hasPhone: boolean }>> {
  try {
    const { id, hasPhone } = await loginWithPassword(input.email, input.password);
    await setCustomerSession(id);
    return { ok: true, data: { hasPhone } };
  } catch (e) {
    if (!(e instanceof AuthError) && !(e instanceof z.ZodError)) console.error("[login]", e);
    await new Promise((r) => setTimeout(r, 400)); // frena intentos automáticos
    return fail(e);
  }
}

export async function registerAction(input: { firstName: string; email: string; password: string }): Promise<ActionResult<null>> {
  try {
    const id = await registerWithPassword(input);
    await setCustomerSession(id);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Crear o cambiar la contraseña desde Mi cuenta (p. ej. después de entrar con WhatsApp porque la olvidó). */
export async function setPasswordAction(input: { email: string; password: string }): Promise<ActionResult<null>> {
  const id = await currentCustomerId();
  if (!id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  try {
    await setPassword(id, input.email, input.password);
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function logoutCustomerAction() {
  await logoutCustomer();
  redirect("/");
}

// ---------- Perfil ----------

export type Profile = {
  /** Vacío si la cuenta se creó con Google y aún no vinculó su WhatsApp. */
  phone: string;
  google: boolean;
  /** Correo con el que entra con contraseña (vacío si no tiene contraseña). */
  loginEmail: string;
  firstName: string;
  lastName: string;
  document: string;
  email: string;
  acceptsMarketing: boolean;
  departamento: string;
  provincia: string;
  distrito: string;
  address: string;
  reference: string;
};

/** Datos del cliente con sesión (para precargar el checkout), o null. */
export async function getProfileAction(): Promise<Profile | null> {
  const id = await currentCustomerId();
  if (!id) return null;
  const [c] = await query<Record<string, string | boolean | null>>("select * from customers where id = $1", [id]);
  if (!c) return null;
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  return {
    phone: s("phone"),
    google: !!c.google_sub,
    loginEmail: c.password_hash ? s("login_email") : "",
    firstName: s("first_name"),
    lastName: s("last_name"),
    document: s("document"),
    email: s("email"),
    acceptsMarketing: c.accepts_marketing === true,
    departamento: s("departamento"),
    provincia: s("provincia"),
    distrito: s("distrito"),
    address: s("address"),
    reference: s("reference"),
  };
}

/** Sesión actual y opciones de ingreso disponibles (para el checkout). */
export async function sessionInfoAction(): Promise<{ profile: Profile | null; google: boolean }> {
  return { profile: await getProfileAction(), google: googleEnabled() };
}

const t = (max: number) => z.string().trim().max(max);
const profileInput = z.object({
  firstName: t(60).min(1, "Ingresa tu nombre"),
  lastName: t(80),
  document: t(15),
  email: z.union([z.literal(""), z.email("Correo inválido").max(120)]),
  acceptsMarketing: z.boolean(),
  departamento: z.union([z.literal(""), z.enum(departamentos as [string, ...string[]])]),
  provincia: t(60),
  distrito: t(60),
  address: t(160),
  reference: t(160),
});

export async function updateProfileAction(raw: z.input<typeof profileInput>): Promise<ActionResult<null>> {
  const id = await currentCustomerId();
  if (!id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  try {
    const p = profileInput.parse(raw);
    await query(
      `update customers set first_name = $2, last_name = $3, document = nullif($4, ''), email = nullif($5, ''), accepts_marketing = $6,
         departamento = nullif($7, ''), provincia = nullif($8, ''), distrito = nullif($9, ''), address = nullif($10, ''), reference = nullif($11, '')
       where id = $1`,
      [id, p.firstName, p.lastName, p.document, p.email, p.acceptsMarketing, p.departamento, p.provincia, p.distrito, p.address, p.reference],
    );
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Cotizaciones ----------

export async function requestQuoteAction(input: {
  items: { variantId: number; qty: number }[];
  note: string;
}): Promise<ActionResult<{ code: string; url: string }>> {
  const id = await currentCustomerId();
  if (!id) return { ok: false, error: "Entra a tu cuenta para pedir una cotización." };
  const [c] = await query<{ phone: string | null }>("select phone from customers where id = $1", [id]);
  if (!c?.phone) return { ok: false, error: "Vincula tu WhatsApp para pedir cotizaciones." };
  try {
    const { code } = await requestQuote(id, input);
    return { ok: true, data: { code, url: await wa(`Hola ${store.name}, pedí la cotización *${code}* 📝`) } };
  } catch (e) {
    return fail(e);
  }
}

const deliveryInput = z.object({
  delivery: z.enum(["domicilio", "tienda"]),
  departamento: z.string().optional(),
  provincia: z.string().optional(),
  distrito: z.string().optional(),
  address: z.string().optional(),
  reference: z.string().optional(),
  payment: z.enum(["yape", "plin"]),
});

export async function acceptQuoteAction(
  code: string,
  raw: z.input<typeof deliveryInput>,
): Promise<ActionResult<CreatedOrder & { url: string }>> {
  const id = await currentCustomerId();
  if (!id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  try {
    const order = await acceptQuote(id, code, deliveryInput.parse(raw));
    updateTag(PRODUCTS_TAG); // se reservó stock
    refresh();
    return { ok: true, data: { ...order, url: await wa(`Hola ${store.name}, acepté la cotización ${code}. Mi pedido es *${order.code}*`) } };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectQuoteAction(code: string): Promise<ActionResult<null>> {
  const id = await currentCustomerId();
  if (!id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  try {
    const quote = await getQuote(code);
    if (!quote || quote.customer_id !== id) return { ok: false, error: "Cotización no encontrada." };
    await rejectQuote(quote.id, id);
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Reseñas ----------

/** Califica un perfume de un pedido entregado (con foto opcional). Queda pendiente de aprobación. */
export async function submitReviewAction(form: FormData): Promise<ActionResult<null>> {
  const id = await currentCustomerId();
  if (!id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  const { ReviewError, submitReview } = await import("@/server/reviews");
  const { ALLOWED_TYPES, putFile } = await import("@/server/storage");
  try {
    let photoKey: string | undefined;
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!ALLOWED_TYPES.includes(photo.type) || photo.type === "application/pdf") return { ok: false, error: "La foto debe ser JPG, PNG o WebP." };
      if (photo.size > 4 * 1024 * 1024) return { ok: false, error: "La foto pesa más de 4 MB." };
      photoKey = await putFile("public", Buffer.from(await photo.arrayBuffer()), photo.type);
    }
    await submitReview(
      id,
      String(form.get("code") ?? ""),
      Number(form.get("productId")),
      { rating: Number(form.get("rating")), body: String(form.get("body") ?? "") },
      photoKey,
    );
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message };
    return fail(e);
  }
}
