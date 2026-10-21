"use client";

import { useState, useTransition } from "react";
import { newsletterAction } from "@/app/actions";

export function Newsletter() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <p className="text-sm font-semibold">Recibe novedades y lanzamientos</p>
      {sent ? (
        <p className="mt-3 text-sm text-emerald-700">¡Listo! Te avisaremos de las novedades.</p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const email = new FormData(e.currentTarget).get("email")?.toString() ?? "";
            start(async () => {
              const res = await newsletterAction(email);
              if (res.ok) setSent(true);
              else setError(res.error);
            });
          }}
        >
          <input
            type="email"
            name="email"
            required
            placeholder="tu@email.com"
            className="min-w-0 flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          />
          <button disabled={pending} className="bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">Unirme</button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
