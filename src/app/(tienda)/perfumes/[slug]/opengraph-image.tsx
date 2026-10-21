import { store } from "@/lib/config";
import { getProduct, getProducts } from "@/server/catalog";
import { OG_SIZE, productCard, storeCard } from "@/server/og";

export const alt = `Perfume en ${store.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

/** Imagen al compartir un perfume: frasco (o foto), nombre, precio y estrellas. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  return product ? productCard(product) : storeCard();
}
