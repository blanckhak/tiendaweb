import Link from "next/link";
import { discountPct, minVariant, stockBadge, totalStock } from "@/lib/catalog";
import { soles } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductImage } from "./product-image";
import { Stars } from "./stars";
import { FavoriteButton } from "./favorite-button";

export function StockTag({ stock }: { stock: number }) {
  const badge = stockBadge(stock);
  const tone =
    badge === "En stock" ? "bg-emerald-700" : badge === "Últimas unidades" ? "bg-amber-600" : "bg-neutral-500";
  return (
    <span className={`rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ${tone}`}>
      {badge}
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const v = minVariant(product);
  const off = discountPct(product);
  return (
    <Link href={`/perfumes/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        <ProductImage product={product} className="transition duration-500 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <StockTag stock={totalStock(product)} />
          {off > 0 && (
            <span className="rounded-sm bg-gold px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink">-{off}%</span>
          )}
        </div>
        <FavoriteButton slug={product.slug} className="absolute right-2 top-2" />
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{product.brand}</p>
        <h3 className="text-sm leading-snug">{product.name} Eau de Parfum</h3>
        {product.rating && (
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Stars value={product.rating.avg} size="text-xs" /> {product.rating.avg.toFixed(1)} ({product.rating.count})
          </p>
        )}
        <p className="text-sm">
          <span className="font-semibold">{soles(v.price)}</span>
          {v.compareAt && <span className="ml-2 text-neutral-400 line-through">{soles(v.compareAt)}</span>}
        </p>
      </div>
    </Link>
  );
}
