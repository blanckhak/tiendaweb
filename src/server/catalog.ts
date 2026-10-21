import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { discountPct } from "@/lib/catalog";
import type { Gender, Product } from "@/lib/types";
import { query } from "./db";
import { publicUrl } from "./storage";

export const PRODUCTS_TAG = "products";

type ProductRow = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  gender: Gender;
  family: string;
  description: string;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  featured: boolean;
  is_new: boolean;
  colors: Product["colors"];
  image_key: string | null;
  rating_avg: number | null;
  rating_count: number;
  variants: { id: number; ml: number; sku: string; price_cents: number; compare_at_cents: number | null; available: number }[];
};

const SELECT = `
  select p.*, coalesce(json_agg(json_build_object(
      'id', v.id, 'ml', v.ml, 'sku', v.sku, 'price_cents', v.price_cents,
      'compare_at_cents', v.compare_at_cents, 'available', greatest(v.stock - v.reserved, 0)
    ) order by v.ml) filter (where v.id is not null), '[]') as variants,
    (select round(avg(rating)::numeric, 1)::float8 from reviews r where r.product_id = p.id and r.status = 'aprobada') as rating_avg,
    (select count(*)::int from reviews r where r.product_id = p.id and r.status = 'aprobada') as rating_count
  from products p left join product_variants v on v.product_id = p.id`;

function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    slug: r.slug,
    brand: r.brand,
    name: r.name,
    gender: r.gender,
    family: r.family,
    description: r.description,
    notes: { top: r.notes_top, heart: r.notes_heart, base: r.notes_base },
    featured: r.featured,
    isNew: r.is_new,
    colors: typeof r.colors === "string" ? JSON.parse(r.colors) : r.colors,
    image: r.image_key ? publicUrl(r.image_key) : undefined,
    rating: r.rating_count > 0 && r.rating_avg ? { avg: Number(r.rating_avg), count: r.rating_count } : undefined,
    variants: (typeof r.variants === "string" ? JSON.parse(r.variants) : r.variants).map((v: ProductRow["variants"][number]) => ({
      id: v.id,
      ml: v.ml,
      sku: v.sku,
      price: v.price_cents / 100,
      compareAt: v.compare_at_cents ? v.compare_at_cents / 100 : undefined,
      stock: v.available,
    })),
  };
}

/** Catálogo visible en la tienda. Se invalida con updateTag/revalidateTag(PRODUCTS_TAG). */
export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("minutes"); // el stock cambia seguido; además se invalida al vender o editar
  cacheTag(PRODUCTS_TAG);
  const rows = await query<ProductRow>(`${SELECT} where p.active group by p.id order by p.featured desc, p.created_at, p.id`);
  return rows.map(toProduct).filter((p) => p.variants.length > 0);
}

export const getProduct = async (slug: string) => (await getProducts()).find((p) => p.slug === slug);
export const getFeatured = async () => (await getProducts()).filter((p) => p.featured);
export const getNew = async () => (await getProducts()).filter((p) => p.isNew);
/** En oferta (precio normal tachado), del mayor descuento al menor. */
export const getOffers = async () =>
  (await getProducts()).filter((p) => discountPct(p) > 0).sort((a, b) => discountPct(b) - discountPct(a));

/** Sin caché, incluye productos inactivos: para el panel admin. */
export async function getAllProductsForAdmin() {
  const rows = await query<ProductRow & { active: boolean; stock_rows: unknown }>(
    `${SELECT} group by p.id order by p.brand, p.name`,
  );
  return rows.map((r) => ({ ...toProduct(r), active: r.active }));
}
