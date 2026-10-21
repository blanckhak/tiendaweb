"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { FREE_SHIPPING_FROM, freeShippingEnabled, freeShippingZones } from "@/lib/shipping";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from "./icons";
import { useStore } from "./store-provider";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/encuentra-tu-perfume", label: "Encuentra tu perfume ✨" },
  { href: "/perfumes", label: "Todos los perfumes" },
  { href: "/perfumes?genero=Hombre", label: "Hombre" },
  { href: "/perfumes?genero=Mujer", label: "Mujer" },
  { href: "/perfumes?genero=Unisex", label: "Unisex" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/seguimiento", label: "Sigue tu pedido" },
  { href: "/cuenta", label: "Mi cuenta" },
  { href: "/cotizar", label: "Cotizaciones por cantidad" },
  { href: "/bolsa", label: "Mi bolsa" },
];

export function Header() {
  const { count } = useStore();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-ink py-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
        Envíos a nivel nacional
        {freeShippingEnabled && (
          <span className="hidden sm:inline">
            {" "}· Envío gratis en {freeShippingZones} desde {soles(FREE_SHIPPING_FROM)}
          </span>
        )}
      </div>
      <div className="border-b border-line bg-white">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <button onClick={() => setMenu(true)} aria-label="Abrir menú" className="p-1">
            <MenuIcon className="size-6" />
          </button>
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 border border-ink px-5 py-1 text-xs font-bold tracking-[0.3em]"
          >
            {store.name}
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setSearch((s) => !s)} aria-label="Buscar" className="p-1">
              <SearchIcon className="size-5" />
            </button>
            <Link href="/cuenta" aria-label="Mi cuenta" className="p-1">
              <UserIcon className="size-5" />
            </Link>
            <Link href="/bolsa" aria-label={`Bolsa, ${count} productos`} className="relative p-1">
              <BagIcon className="size-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-wine text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
        {search && (
          <form
            className="mx-auto max-w-6xl px-4 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q")?.toString().trim();
              setSearch(false);
              router.push(q ? `/perfumes?q=${encodeURIComponent(q)}` : "/perfumes");
            }}
          >
            <input
              name="q"
              autoFocus
              placeholder="Buscar perfume o marca…"
              className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-ink"
            />
          </form>
        )}
      </div>

      {menu && (
        <div className="fixed inset-0 z-50 flex">
          <nav className="flex w-80 max-w-[85%] flex-col bg-white p-6 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <span className="border border-ink px-4 py-1 text-xs font-bold tracking-[0.3em]">{store.name}</span>
              <button onClick={() => setMenu(false)} aria-label="Cerrar menú">
                <CloseIcon className="size-6" />
              </button>
            </div>
            <ul className="space-y-4 text-lg">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setMenu(false)} className="hover:text-wine">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <button aria-label="Cerrar menú" className="flex-1 bg-black/40" onClick={() => setMenu(false)} />
        </div>
      )}
    </header>
  );
}
