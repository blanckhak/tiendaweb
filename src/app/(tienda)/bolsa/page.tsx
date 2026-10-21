"use client";

import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { useStore } from "@/components/store-provider";
import { Totals } from "@/components/totals";
import { soles } from "@/lib/format";

export default function BagPage() {
  const { ready, lines, subtotal, setQty, remove, index: productIndex } = useStore();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-xs text-neutral-500">
        <Link href="/">Inicio</Link> / Bolsa
      </nav>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Aurum / Bolsa</p>
      <h1 className="mt-2 text-4xl">Tu bolsa</h1>
      <p className="mt-2 text-sm text-neutral-500">Revisa cantidades, disponibilidad y subtotal antes de continuar al checkout.</p>

      {!ready ? null : lines.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-neutral-500">Tu bolsa está vacía.</p>
          <Link href="/perfumes" className="mt-4 inline-block bg-ink px-6 py-3 text-sm text-white">
            Ver perfumes
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 md:grid-cols-[1fr_340px]">
          <ul className="divide-y divide-line border-y border-line">
            {lines.map((l) => (
              <li key={`${l.slug}-${l.ml}`} className="flex gap-4 py-5">
                <Link href={`/perfumes/${l.slug}`} className="relative size-24 shrink-0 overflow-hidden bg-mist">
                  <ProductImage product={productIndex[l.slug]} />
                </Link>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500">{l.brand}</p>
                  <p className="text-sm">{l.name} Eau de Parfum</p>
                  <p className="text-xs text-neutral-500">{l.ml} ml</p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center border border-line bg-white">
                      <button className="px-3 py-1" onClick={() => setQty(l.slug, l.ml, l.qty - 1)} aria-label="Restar">
                        −
                      </button>
                      <span className="w-8 text-center text-sm">{l.qty}</span>
                      <button
                        className="px-3 py-1 disabled:opacity-30"
                        disabled={l.qty >= l.stock}
                        onClick={() => setQty(l.slug, l.ml, l.qty + 1)}
                        aria-label="Sumar"
                      >
                        +
                      </button>
                    </div>
                    <button className="text-xs underline" onClick={() => remove(l.slug, l.ml)}>
                      Eliminar
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    {soles(l.price)} c/u · <span className="font-semibold text-ink">{soles(l.price * l.qty)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit border border-line bg-white p-5">
            <Totals subtotal={subtotal} />
            <Link href="/checkout" className="mt-5 block bg-wine py-3.5 text-center text-sm font-semibold text-white">
              Continuar compra
            </Link>
            <p className="mt-3 text-xs text-neutral-500">El envío y el pago se coordinan por WhatsApp al finalizar.</p>
            <Link href="/cotizar" className="mt-4 block border border-ink py-3 text-center text-sm hover:bg-ink hover:text-white">
              ¿Compras por cantidad? Pedir cotización
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
