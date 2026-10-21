import type { Product, Variant } from "./types";

// Funciones puras sobre productos. Los datos vienen de src/server/catalog.ts.

export const minVariant = (p: Product): Variant =>
  p.variants.reduce((a, b) => (b.price < a.price ? b : a));

export const totalStock = (p: Product) => p.variants.reduce((s, v) => s + v.stock, 0);

export type StockBadge = "En stock" | "Últimas unidades" | "Agotado";

export const stockBadge = (stock: number): StockBadge =>
  stock === 0 ? "Agotado" : stock <= 3 ? "Últimas unidades" : "En stock";

/** Mayor descuento del perfume en %, o 0 si ninguna presentación está en oferta. */
export const discountPct = (p: Product) =>
  Math.max(0, ...p.variants.map((v) => (v.compareAt && v.compareAt > v.price ? Math.round((1 - v.price / v.compareAt) * 100) : 0)));

export const indexBySlug = (products: Product[]) => Object.fromEntries(products.map((p) => [p.slug, p]));
