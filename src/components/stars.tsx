/** Estrellas de 0 a 5 (admite medias estrellas visuales con el ancho del relleno). */
export function Stars({ value, size = "text-sm", label = true }: { value: number; size?: string; label?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={`relative inline-block leading-none ${size}`} role="img" aria-label={`${value.toFixed(1)} de 5 estrellas`}>
      <span className="text-neutral-300" aria-hidden>★★★★★</span>
      <span className="absolute inset-0 overflow-hidden text-amber-500" style={{ width: `${pct}%` }} aria-hidden>
        ★★★★★
      </span>
      {label && <span className="sr-only">{value.toFixed(1)} de 5</span>}
    </span>
  );
}
