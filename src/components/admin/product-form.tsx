"use client";
/* eslint-disable @next/next/no-img-element -- vista previa de la foto subida */

import Link from "next/link";
import { useState } from "react";
import { deleteVariantAction, saveProductAction } from "@/app/admin/actions";
import { ActionForm } from "./action-form";
import { btn, btnDanger, field } from "./ui";

export type ProductFormData = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  gender: string;
  family: string;
  description: string;
  notesTop: string;
  notesHeart: string;
  notesBase: string;
  featured: boolean;
  isNew: boolean;
  active: boolean;
  colors: { glass: string; cap: string; liquid: string };
  image?: string;
  variants: { id?: number; ml: number; sku: string; price: number; compareAt?: number; stock: number; reserved?: number }[];
};

const families = ["Cítrico", "Acuático", "Frutal", "Floral", "Especiado", "Amaderado", "Oriental"];

function L({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

export function ProductForm({ product }: { product: ProductFormData | null }) {
  const p = product;
  // Cada fila lleva una clave estable para que quitar una del medio no mezcle valores.
  const [rows, setRows] = useState<(ProductFormData["variants"][number] & { key: string })[]>(() =>
    (p?.variants.length ? p.variants : [{ ml: 100, sku: "", price: 0, stock: 0 }]).map((v, i) => ({ ...v, key: `r${i}` })),
  );

  return (
    <div className="space-y-6">
      <ActionForm action={saveProductAction} className="space-y-6">
        {p && <input type="hidden" name="id" value={p.id} />}
        <input type="hidden" name="variantCount" value={rows.length} />

        <section className="grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-2">
          <L label="Marca">
            <input name="brand" required defaultValue={p?.brand} className={field} />
          </L>
          <L label="Nombre">
            <input name="name" required defaultValue={p?.name} className={field} />
          </L>
          <L label="Género">
            <select name="gender" defaultValue={p?.gender ?? "Unisex"} className={field}>
              <option>Hombre</option>
              <option>Mujer</option>
              <option>Unisex</option>
            </select>
          </L>
          <L label="Familia olfativa">
            <input name="family" required list="families" defaultValue={p?.family} className={field} />
            <datalist id="families">
              {families.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </L>
          <L label="Descripción" className="md:col-span-2">
            <textarea name="description" rows={3} defaultValue={p?.description} className={field} />
          </L>
          <L label="Notas de salida (separadas por coma)">
            <input name="notesTop" defaultValue={p?.notesTop} className={field} />
          </L>
          <L label="Notas de corazón">
            <input name="notesHeart" defaultValue={p?.notesHeart} className={field} />
          </L>
          <L label="Notas de fondo">
            <input name="notesBase" defaultValue={p?.notesBase} className={field} />
          </L>
          <div className="flex flex-wrap items-end gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Visible en la tienda
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="featured" defaultChecked={p?.featured} /> Destacado
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isNew" defaultChecked={p?.isNew} /> Nuevo
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">Presentaciones, precio y stock</h2>
          <div className="space-y-3">
            {rows.map((v, i) => (
              <div key={v.key} className="grid grid-cols-2 gap-2 rounded-md border border-line p-3 sm:grid-cols-6">
                {v.id && <input type="hidden" name={`v${i}.id`} value={v.id} />}
                <L label="ml">
                  <input name={`v${i}.ml`} type="number" min="1" required defaultValue={v.ml} className={field} />
                </L>
                <L label="SKU">
                  <input name={`v${i}.sku`} required defaultValue={v.sku} className={field} />
                </L>
                <L label="Precio S/">
                  <input name={`v${i}.price`} type="number" min="0" step="0.1" required defaultValue={v.price || ""} className={field} />
                </L>
                <L label="Antes S/ (opcional)">
                  <input name={`v${i}.compareAt`} type="number" min="0" step="0.1" defaultValue={v.compareAt ?? ""} className={field} />
                </L>
                <L label="Stock físico">
                  <input name={`v${i}.stock`} type="number" min={v.reserved ?? 0} required defaultValue={v.stock} className={field} />
                </L>
                <div className="flex items-end text-xs text-neutral-500">
                  {v.reserved ? (
                    `${v.reserved} reservadas en pedidos sin pagar`
                  ) : !v.id ? (
                    <button type="button" className="underline" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-sm underline"
            onClick={() => setRows((r) => [...r, { ml: 50, sku: "", price: 0, stock: 0, key: `r${Date.now()}` }])}
          >
            + Agregar presentación
          </button>
        </section>

        <section className="grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-2">
          <div>
            <L label="Foto (JPG, PNG o WebP, máx. 4 MB)">
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
            </L>
            {p?.image && <img src={p.image} alt="" className="mt-3 h-40 rounded object-cover" />}
            <p className="mt-2 text-xs text-neutral-500">Sin foto, la tienda muestra el frasco ilustrado con estos colores:</p>
            <div className="mt-2 flex gap-4 text-sm">
              <L label="Vidrio">
                <input type="color" name="glass" defaultValue={p?.colors.glass ?? "#222222"} />
              </L>
              <L label="Tapa">
                <input type="color" name="cap" defaultValue={p?.colors.cap ?? "#c9a45c"} />
              </L>
              <L label="Líquido">
                <input type="color" name="liquid" defaultValue={p?.colors.liquid ?? "#444444"} />
              </L>
            </div>
          </div>
          <div className="flex items-end justify-end gap-3">
            {p && (
              <Link href={`/perfumes/${p.slug}`} target="_blank" className="text-sm underline">
                Ver en la tienda ↗
              </Link>
            )}
            <button className={btn}>Guardar</button>
          </div>
        </section>
      </ActionForm>

      {p?.variants.some((v) => v.id) && (
        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">Quitar presentaciones</h2>
          <div className="flex flex-wrap gap-2">
            {p.variants.map((v) => (
              <form key={v.id} action={deleteVariantAction}>
                <input type="hidden" name="variantId" value={v.id} />
                <button className={btnDanger}>Quitar {v.ml} ml</button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">Si ya se vendió, queda sin stock para conservar el historial de pedidos.</p>
        </section>
      )}
    </div>
  );
}
