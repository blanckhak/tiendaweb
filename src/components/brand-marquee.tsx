/** Franja animada con las marcas que de verdad están en el catálogo. */
export function BrandMarquee({ brands }: { brands: string[] }) {
  // Se repite hasta llenar el ancho y luego se duplica para que el bucle no tenga cortes.
  const base = Array.from({ length: Math.max(1, Math.ceil(8 / brands.length)) }, () => brands).flat();
  const row = [...base, ...base];
  return (
    <div className="overflow-hidden border-y border-line bg-white py-5" aria-label={`Marcas: ${brands.join(", ")}`}>
      <div className="animate-marquee flex w-max gap-14 pr-14" aria-hidden>
        {row.map((b, i) => (
          <span key={i} className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-400">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
