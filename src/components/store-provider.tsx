"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { indexBySlug } from "@/lib/catalog";
import type { CartItem, Product } from "@/lib/types";

type Line = CartItem & { variantId: number; name: string; brand: string; price: number; stock: number };

type Store = {
  /** WhatsApp del negocio para los enlaces wa.me (Panel → Ajustes). */
  whatsapp: string;
  /** Asistente con IA visible en la tienda (Panel → Ajustes). */
  assistant: boolean;
  /** false durante el render del servidor: la bolsa aún no se leyó del navegador. */
  ready: boolean;
  /** Catálogo actual por slug (precios y stock vienen del servidor). */
  index: Record<string, Product>;
  items: CartItem[];
  lines: Line[];
  count: number;
  subtotal: number;
  add: (slug: string, ml: number, qty: number) => void;
  setQty: (slug: string, ml: number, qty: number) => void;
  remove: (slug: string, ml: number) => void;
  clear: () => void;
  favorites: string[];
  toggleFavorite: (slug: string) => void;
};

// Estado persistido en localStorage, expuesto a React como store externo.
type Persisted = { items: CartItem[]; favorites: string[] };

const KEY = "aurum.store.v1";
const EMPTY: Persisted = { items: [], favorites: [] };
const listeners = new Set<() => void>();
let state: Persisted | null = null;

function read(): Persisted {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...EMPTY, ...(JSON.parse(raw) as Persisted) } : EMPTY;
  } catch {
    state = EMPTY;
  }
  return state;
}

function write(update: (prev: Persisted) => Persisted) {
  state = update(read());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Almacenamiento bloqueado (modo privado): la bolsa vive solo en memoria.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    state = null; // otra pestaña cambió la bolsa
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const noopSubscribe = () => () => {};

const StoreContext = createContext<Store | null>(null);

type ProviderProps = { products: Product[]; whatsapp: string; assistant: boolean; children: React.ReactNode };

export function StoreProvider({ products, whatsapp, assistant, children }: ProviderProps) {
  const productIndex = useMemo(() => indexBySlug(products), [products]);
  const { items, favorites } = useSyncExternalStore(subscribe, read, () => EMPTY);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const lines = useMemo(
    () =>
      items.flatMap((i) => {
        const p = productIndex[i.slug];
        const v = p?.variants.find((x) => x.ml === i.ml);
        return p && v ? [{ ...i, variantId: v.id, name: p.name, brand: p.brand, price: v.price, stock: v.stock }] : [];
      }),
    [items, productIndex],
  );

  const setItems = (fn: (prev: CartItem[]) => CartItem[]) => write((s) => ({ ...s, items: fn(s.items) }));

  const add = useCallback((slug: string, ml: number, qty: number) => {
    const stock = productIndex[slug]?.variants.find((v) => v.ml === ml)?.stock ?? 0;
    setItems((prev) => {
      const found = prev.find((i) => i.slug === slug && i.ml === ml);
      if (found) return prev.map((i) => (i === found ? { ...i, qty: Math.min(stock, i.qty + qty) } : i));
      return [...prev, { slug, ml, qty: Math.min(stock, qty) }];
    });
  }, [productIndex]);

  const setQty = useCallback((slug: string, ml: number, qty: number) => {
    setItems((prev) => prev.map((i) => (i.slug === slug && i.ml === ml ? { ...i, qty: Math.max(1, qty) } : i)));
  }, []);

  const remove = useCallback((slug: string, ml: number) => {
    setItems((prev) => prev.filter((i) => !(i.slug === slug && i.ml === ml)));
  }, []);

  const clear = useCallback(() => setItems(() => []), []);

  const toggleFavorite = useCallback((slug: string) => {
    write((s) => ({
      ...s,
      favorites: s.favorites.includes(slug) ? s.favorites.filter((f) => f !== slug) : [...s.favorites, slug],
    }));
  }, []);

  const value: Store = {
    whatsapp,
    assistant,
    ready,
    index: productIndex,
    items,
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.qty * l.price, 0),
    add,
    setQty,
    remove,
    clear,
    favorites,
    toggleFavorite,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}
