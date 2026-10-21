"use client";

import { useStore } from "./store-provider";
import { HeartIcon } from "./icons";

export function FavoriteButton({ slug, className = "" }: { slug: string; className?: string }) {
  const { favorites, toggleFavorite } = useStore();
  const active = favorites.includes(slug);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        toggleFavorite(slug);
      }}
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={active}
      className={`grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-sm transition hover:scale-105 ${className}`}
    >
      <HeartIcon className={`size-[18px] ${active ? "text-wine" : ""}`} filled={active} />
    </button>
  );
}
