"use client";

import { useState, useTransition } from "react";
import { submitReviewAction } from "@/app/cuenta-actions";

const LABELS = ["", "Malo", "Regular", "Bueno", "Muy bueno", "¡Excelente!"];

/** Formulario para calificar un perfume: estrellas, comentario y foto opcional. */
export function ReviewForm({ code, productId }: { code: string; productId: number }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) return <p className="text-sm text-emerald-700">¡Gracias por tu opinión! La publicaremos en breve.</p>;
  const shown = hover || rating;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Elige de 1 a 5 estrellas.");
        const f = new FormData(e.currentTarget);
        f.set("rating", String(rating));
        f.set("code", code);
        f.set("productId", String(productId));
        setError(null);
        start(async () => {
          const res = await submitReviewAction(f);
          if (res.ok) setDone(true);
          else setError(res.error);
        });
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Calificación">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} estrellas`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className={`px-0.5 text-3xl leading-none transition ${n <= shown ? "text-amber-500" : "text-neutral-300"} hover:scale-110`}
            >
              ★
            </button>
          ))}
        </div>
        <span className="text-sm text-neutral-600">{LABELS[shown]}</span>
      </div>
      <textarea
        name="body"
        rows={3}
        maxLength={1000}
        placeholder="¿Qué te pareció el aroma, la duración, la presentación? (opcional)"
        className="w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink"
      />
      <label className="block text-sm text-neutral-600">
        Foto (opcional, máx. 4 MB)
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-sm" />
      </label>
      {error && <p className="bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <button disabled={pending} className="bg-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Enviando…" : "Publicar opinión"}
      </button>
    </form>
  );
}
