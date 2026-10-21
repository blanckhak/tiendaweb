import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { PRODUCTS_TAG } from "./catalog";
import { query } from "./db";
import { notifyOwner } from "./whatsapp";

export class ReviewError extends Error {}

export type PublicReview = { id: number; rating: number; body: string; photo_key: string | null; created_at: Date; author: string };

/** Productos de un pedido entregado de este cliente, con su reseña si ya calificó. */
export async function reviewableItems(customerId: number, orderCode: string) {
  const [o] = await query<{ id: number; status: string }>(
    "select id, status from orders where code = $1 and customer_id = $2",
    [orderCode.toUpperCase(), customerId],
  );
  if (!o) return null;
  const items = await query<{ product_id: number; slug: string; brand: string; name: string; rating: number | null; body: string | null; status: string | null }>(
    `select distinct on (p.id) p.id as product_id, p.slug, p.brand, p.name, r.rating, r.body, r.status
     from order_items oi
     join product_variants v on v.id = oi.variant_id
     join products p on p.id = v.product_id
     left join reviews r on r.order_id = oi.order_id and r.product_id = p.id
     where oi.order_id = $1 order by p.id`,
    [o.id],
  );
  return { orderId: o.id, delivered: o.status === "entregado", items };
}

const reviewInput = z.object({
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas").max(5),
  body: z.string().trim().max(1000).default(""),
});

/** Solo quien recibió el pedido puede calificar sus productos, una vez por producto y pedido. */
export async function submitReview(
  customerId: number,
  orderCode: string,
  productId: number,
  raw: z.input<typeof reviewInput>,
  photoKey?: string,
) {
  const input = reviewInput.parse(raw);
  const info = await reviewableItems(customerId, orderCode);
  if (!info) throw new ReviewError("Pedido no encontrado.");
  if (!info.delivered) throw new ReviewError("Podrás calificar cuando recibas tu pedido.");
  const item = info.items.find((i) => i.product_id === productId);
  if (!item) throw new ReviewError("Ese perfume no está en tu pedido.");
  if (item.rating) throw new ReviewError("Ya calificaste este perfume. ¡Gracias!");
  await query(
    `insert into reviews (product_id, customer_id, order_id, rating, body, photo_key) values ($1, $2, $3, $4, $5, $6)`,
    [productId, customerId, info.orderId, input.rating, input.body, photoKey ?? null],
  );
  await notifyOwner(`Nueva reseña de ${input.rating}★ para ${item.brand} ${item.name}. Apruébala en el panel.`);
}

/** Reseñas aprobadas de un perfume (autor: nombre y la inicial del apellido). */
export async function approvedReviews(productId: number): Promise<PublicReview[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PRODUCTS_TAG);
  return query<PublicReview>(
    `select r.id, r.rating, r.body, r.photo_key, r.created_at,
            trim(coalesce(nullif(c.first_name, ''), 'Cliente') || ' ' || coalesce(left(nullif(c.last_name, ''), 1) || '.', '')) as author
     from reviews r join customers c on c.id = r.customer_id
     where r.product_id = $1 and r.status = 'aprobada' order by r.created_at desc limit 30`,
    [productId],
  );
}

export async function moderateReview(id: number, status: "aprobada" | "rechazada") {
  await query("update reviews set status = $2 where id = $1", [id, status]);
}

export function listReviewsForAdmin(status?: string) {
  return query<{ id: number; rating: number; body: string; photo_key: string | null; status: string; created_at: Date; brand: string; name: string; first_name: string; last_name: string; code: string }>(
    `select r.id, r.rating, r.body, r.photo_key, r.status, r.created_at, p.brand, p.name, c.first_name, c.last_name, o.code
     from reviews r join products p on p.id = r.product_id join customers c on c.id = r.customer_id join orders o on o.id = r.order_id
     ${status ? "where r.status = $1" : ""} order by r.created_at desc limit 200`,
    status ? [status] : [],
  );
}
