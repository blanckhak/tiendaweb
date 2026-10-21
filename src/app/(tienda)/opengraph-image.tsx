import { store } from "@/lib/config";
import { getFeatured } from "@/server/catalog";
import { OG_SIZE, storeCard } from "@/server/og";

export const alt = `${store.name} · Perfumes originales`;
export const size = OG_SIZE;
export const contentType = "image/png";

/** Imagen al compartir la tienda (inicio y páginas sin imagen propia). */
export default async function Image() {
  const [hero] = await getFeatured();
  return storeCard(hero);
}
