"use client";

import { useMemo, useState } from "react";
import { discountPct, minVariant } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";

type Sort = "relevancia" | "precio-asc" | "precio-desc" | "nombre";

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const fieldClass =
  "border border-line bg-white px-2 py-2 text-sm normal-case tracking-normal text-ink outline-none focus:border-ink";
const labelClass = "flex flex-col gap-1 text-[11px] uppercase tracking-wider text-neutral-500";

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className={labelClass}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

type Initial = { q: string; genero: string; ofertas: boolean };

export function Catalog({ products, initial }: { products: Product[]; initial: Initial }) {
  const [q, setQ] = useState(initial.q);
  const [genero, setGenero] = useState(initial.genero);
  const [marca, setMarca] = useState("");
  const [familia, setFamilia] = useState("");
  // Rango de precio en soles ("" = sin límite). Se compara con la presentación más barata.
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [ofertas, setOfertas] = useState(initial.ofertas);
  const [sort, setSort] = useState<Sort>("relevancia");

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const families = useMemo(() => [...new Set(products.map((p) => p.family))].sort(), [products]);

  const list = useMemo(() => {
    const term = normalize(q.trim());
    const price = (p: Product) => minVariant(p).price;
    const lo = Number(min) || 0;
    const hi = Number(max) || Infinity;
    const out = products.filter(
      (p) =>
        (!term || normalize(`${p.brand} ${p.name} ${p.family}`).includes(term)) &&
        (!genero || p.gender === genero) &&
        (!marca || p.brand === marca) &&
        (!familia || p.family === familia) &&
        price(p) >= lo &&
        price(p) <= hi &&
        (!ofertas || discountPct(p) > 0),
    );
    if (sort === "precio-asc") out.sort((a, b) => price(a) - price(b));
    if (sort === "precio-desc") out.sort((a, b) => price(b) - price(a));
    if (sort === "nombre") out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [products, q, genero, marca, familia, min, max, ofertas, sort]);
  const filtered = !!(q || genero || marca || familia || min || max || ofertas);
  const reset = () => {
    setQ("");
    setGenero("");
    setMarca("");
    setFamilia("");
    setMin("");
    setMax("");
    setOfertas(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Catálogo</p>
      <h1 className="mt-2 text-4xl">Perfumes</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <label className={`${labelClass} col-span-2 md:col-span-1`}>
          Buscar
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o marca" className={fieldClass} />
        </label>
        <Select label="Género" value={genero} onChange={setGenero} options={["Hombre", "Mujer", "Unisex"]} />
        <Select label="Marca" value={marca} onChange={setMarca} options={brands} />
        <Select label="Familia" value={familia} onChange={setFamilia} options={families} />
        <fieldset className={labelClass}>
          <legend className="mb-1">Precio (S/)</legend>
          <div className="flex items-center gap-1">
            <input
              value={min}
              onChange={(e) => setMin(e.target.value)}
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Desde"
              aria-label="Precio desde"
              className={`${fieldClass} w-full min-w-0`}
            />
            <span aria-hidden>–</span>
            <input
              value={max}
              onChange={(e) => setMax(e.target.value)}
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Hasta"
              aria-label="Precio hasta"
              className={`${fieldClass} w-full min-w-0`}
            />
          </div>
        </fieldset>
        <label className={labelClass}>
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={fieldClass}>
            <option value="relevancia">Relevancia</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="nombre">Nombre</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={ofertas} onChange={(e) => setOfertas(e.target.checked)} className="accent-ink" />
          Solo ofertas
        </label>
        <span className="text-neutral-500">
          {list.length} {list.length === 1 ? "perfume" : "perfumes"}
        </span>
        {filtered && (
          <button onClick={reset} className="underline">
            Limpiar filtros
          </button>
        )}
      </div>
      {list.length ? (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-neutral-500">No encontramos perfumes con esos filtros.</p>
      )}
    </div>
  );
}
