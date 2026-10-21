"use client";

import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { useStore } from "@/components/store-provider";

export default function FavoritesPage() {
  const { ready, favorites, index: productIndex } = useStore();
  const products = favorites.map((s) => productIndex[s]).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl">Favoritos</h1>
      {!ready ? null : products.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-neutral-500">Aún no guardas perfumes. Toca el ♥ en cualquier perfume.</p>
          <Link href="/perfumes" className="mt-4 inline-block bg-ink px-6 py-3 text-sm text-white">
            Ver perfumes
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
