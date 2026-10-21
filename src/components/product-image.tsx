/* eslint-disable @next/next/no-img-element -- las fotos vienen de /media o de Supabase y ya están optimizadas al subirlas */
import type { Product } from "@/lib/types";
import { Bottle } from "./bottle";

/** Foto del producto si existe; si no, el frasco ilustrado con sus colores. */
export function ProductImage({ product, className = "" }: { product: Product; className?: string }) {
  if (product.image) {
    return (
      <img
        src={product.image}
        alt={`${product.brand} ${product.name}`}
        loading="lazy"
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    );
  }
  return <Bottle product={product} className={`absolute inset-0 m-auto h-[80%] w-[80%] ${className}`} />;
}
