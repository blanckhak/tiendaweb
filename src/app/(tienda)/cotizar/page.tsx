"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getProfileAction, requestQuoteAction } from "@/app/cuenta-actions";
import { WhatsAppIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { useStore } from "@/components/store-provider";
import { soles } from "@/lib/format";

/** Pedir cotización: usa los perfumes de la bolsa; las cantidades pueden ser mayores al stock visible. */
export default function QuoteRequestPage() {
  const { ready, lines, index } = useStore();
  const [logged, setLogged] = useState<"no" | "sin-whatsapp" | "si" | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; url: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    getProfileAction().then((p) => setLogged(!p ? "no" : p.phone ? "si" : "sin-whatsapp"));
  }, []);

  const q = (key: string, base: number) => qty[key] ?? base;

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Cotización solicitada</p>
        <h1 className="mt-3 text-4xl">{done.code}</h1>
        <p className="mt-4 text-sm text-neutral-600">
          Envíanos el código por WhatsApp. Te responderemos con los precios por ahí y también los verás en tu cuenta.
        </p>
        <a href={done.url} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 bg-[#25d366] px-6 py-3.5 text-sm font-semibold text-white">
          <WhatsAppIcon className="size-5" /> Enviar por WhatsApp
        </a>
        <p className="mt-6">
          <Link href={`/cuenta/cotizaciones/${done.code}`} className="text-sm underline">Ver mi cotización</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Compras por cantidad</p>
      <h1 className="mt-2 text-4xl">Pedir cotización</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Ideal para regalos corporativos, eventos o compras al por mayor. Ajusta las cantidades, cuéntanos qué necesitas
        y te enviamos un precio especial por WhatsApp.
      </p>

      {!ready || logged === null ? null : logged === "sin-whatsapp" ? (
        <div className="mt-10 border border-line bg-white p-6 text-center">
          <p className="text-sm">Vincula tu WhatsApp para recibir la cotización por ahí.</p>
          <Link href="/cuenta/vincular?next=/cotizar" className="mt-4 inline-flex items-center gap-2 bg-[#25d366] px-6 py-3 text-sm font-semibold text-white">
            <WhatsAppIcon className="size-5" /> Vincular WhatsApp
          </Link>
        </div>
      ) : logged === "no" ? (
        <div className="mt-10 border border-line bg-white p-6 text-center">
          <p className="text-sm">Para pedir una cotización entra o crea tu cuenta (sin contraseña).</p>
          <Link href="/cuenta/ingresar?next=/cotizar" className="mt-4 inline-flex items-center gap-2 bg-[#25d366] px-6 py-3 text-sm font-semibold text-white">
            Entrar o crear cuenta
          </Link>
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-neutral-500">Primero agrega a tu bolsa los perfumes que quieres cotizar.</p>
          <Link href="/perfumes" className="mt-4 inline-block bg-ink px-6 py-3 text-sm text-white">Ver perfumes</Link>
        </div>
      ) : (
        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await requestQuoteAction({
                note,
                items: lines.map((l) => ({ variantId: l.variantId, qty: q(`${l.slug}-${l.ml}`, l.qty) })),
              });
              if (res.ok) setDone(res.data);
              else setError(res.error);
            });
          }}
        >
          <ul className="divide-y divide-line border-y border-line">
            {lines.map((l) => {
              const key = `${l.slug}-${l.ml}`;
              return (
                <li key={key} className="flex items-center gap-4 py-4">
                  <div className="relative size-16 shrink-0 overflow-hidden bg-mist">
                    <ProductImage product={index[l.slug]} />
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="text-xs text-neutral-500">{l.brand}</p>
                    <p>{l.name} · {l.ml} ml</p>
                    <p className="text-xs text-neutral-500">Precio de tienda {soles(l.price)}</p>
                  </div>
                  <label className="text-xs text-neutral-500">
                    Cantidad
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={q(key, l.qty)}
                      onChange={(e) => setQty((s) => ({ ...s, [key]: Math.max(1, Math.min(500, Number(e.target.value) || 1)) }))}
                      className="mt-1 block w-20 border border-line bg-white px-2 py-1.5 text-sm text-ink"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          <label className="mt-6 block text-sm">
            <span className="mb-1 block text-neutral-600">¿Algo más que debamos saber? (opcional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Ej.: 20 perfumes para regalo de fin de año, entrega en Lima la próxima semana, ¿pueden ir en caja de regalo?"
              className="w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink"
            />
          </label>
          {error && <p className="mt-4 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button disabled={pending} className="mt-6 inline-flex items-center gap-2 bg-wine px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
            <WhatsAppIcon className="size-5" /> {pending ? "Enviando…" : "Pedir cotización"}
          </button>
        </form>
      )}
    </div>
  );
}
