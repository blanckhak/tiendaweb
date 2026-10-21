"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { stockAlertAction } from "@/app/actions";
import { soles } from "@/lib/format";
import type { Product } from "@/lib/types";
import { FavoriteButton } from "./favorite-button";
import { StockTag } from "./product-card";
import { useStore } from "./store-provider";

export function ProductPurchase({ product }: { product: Product }) {
  const { add, items } = useStore();
  const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [ml, setMl] = useState(firstAvailable.ml);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const v = product.variants.find((x) => x.ml === ml) ?? firstAvailable;
  const inBag = items.find((i) => i.slug === product.slug && i.ml === v.ml)?.qty ?? 0;
  const available = Math.max(0, v.stock - inBag);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-semibold">{soles(v.price)}</span>
        {v.compareAt && <span className="text-neutral-400 line-through">{soles(v.compareAt)}</span>}
        <StockTag stock={v.stock} />
      </div>
      <p className="mt-1 text-xs text-neutral-400">{v.sku}</p>

      <p className="mt-6 text-[11px] uppercase tracking-wider text-neutral-500">Contenido</p>
      <div className="mt-2 flex gap-2">
        {product.variants.map((x) => (
          <button
            key={x.ml}
            onClick={() => {
              setMl(x.ml);
              setQty(1);
              setAdded(false);
            }}
            className={`border px-4 py-2 text-sm ${x.ml === v.ml ? "border-ink bg-ink text-white" : "border-line bg-white"} ${x.stock === 0 ? "opacity-40" : ""}`}
          >
            {x.ml} ml
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-stretch border border-line bg-white">
        <button className="px-4 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Restar">
          −
        </button>
        <span className="flex-1 py-2 text-center">{qty}</span>
        <button className="px-4 text-lg" onClick={() => setQty((q) => Math.min(Math.max(1, available), q + 1))} aria-label="Sumar">
          +
        </button>
      </div>

      <button
        disabled={available === 0}
        onClick={() => {
          add(product.slug, v.ml, Math.min(qty, available));
          setAdded(true);
          setQty(1);
        }}
        className="mt-3 w-full bg-ink py-3.5 text-sm font-semibold text-white disabled:bg-neutral-400"
      >
        {v.stock === 0 ? "Agotado" : available === 0 ? "Ya tienes todo el stock en tu bolsa" : "Agregar a la bolsa"}
      </button>
      {added && (
        <p className="mt-3 text-sm text-emerald-700">
          Agregado a tu bolsa.{" "}
          <Link href="/bolsa" className="underline">
            Ver bolsa
          </Link>
        </p>
      )}
      {v.stock === 0 ? <StockAlert variantId={v.id} key={v.id} /> : <p className="mt-3 text-xs text-neutral-500">Stock disponible: {v.stock}.</p>}

      <div className="mt-4 flex items-center gap-2 text-sm">
        <FavoriteButton slug={product.slug} className="border border-line shadow-none" /> Favorito
      </div>
    </div>
  );
}

function StockAlert({ variantId }: { variantId: number }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-3 text-sm text-emerald-700">¡Listo! Te avisaremos por WhatsApp cuando vuelva.</p>;
  return (
    <form
      className="mt-4 border border-line bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const phone = new FormData(e.currentTarget).get("phone")?.toString() ?? "";
        start(async () => {
          const res = await stockAlertAction(variantId, phone);
          if (res.ok) setDone(true);
          else setError(res.error);
        });
      }}
    >
      <p className="text-sm font-semibold">Avísame cuando llegue</p>
      <p className="text-xs text-neutral-500">Te escribimos por WhatsApp apenas tengamos stock.</p>
      <div className="mt-3 flex gap-2">
        <input name="phone" required inputMode="tel" placeholder="987 654 321" className="min-w-0 flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-ink" />
        <button disabled={pending} className="bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60">Avisarme</button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </form>
  );
}
