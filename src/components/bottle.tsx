import type { Product } from "@/lib/types";

/** Ilustración del frasco mientras no hay fotos reales del producto. */
export function Bottle({ product, className }: { product: Product; className?: string }) {
  const { glass, cap, liquid } = product.colors;
  const id = product.slug;
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label={`${product.brand} ${product.name}`}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={glass} stopOpacity="0.95" />
          <stop offset="0.5" stopColor={liquid} stopOpacity="0.85" />
          <stop offset="1" stopColor={glass} stopOpacity="1" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="226" rx="60" ry="6" fill="#000" opacity="0.08" />
      <rect x="82" y="34" width="36" height="34" rx="4" fill={cap} />
      <rect x="88" y="66" width="24" height="14" fill={cap} opacity="0.7" />
      <rect x="46" y="78" width="108" height="146" rx="14" fill={`url(#g-${id})`} />
      <rect x="54" y="88" width="10" height="122" rx="5" fill="#fff" opacity="0.18" />
      <rect x="66" y="130" width="68" height="40" rx="3" fill="#fff" opacity="0.14" />
      <text x="100" y="148" textAnchor="middle" fontSize="9" letterSpacing="2" fill="#fff" opacity="0.85">
        {product.brand.toUpperCase()}
      </text>
      <text x="100" y="161" textAnchor="middle" fontSize="7" fill="#fff" opacity="0.7">
        EAU DE PARFUM
      </text>
    </svg>
  );
}
