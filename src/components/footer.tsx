import Link from "next/link";
import { store } from "@/lib/config";
import { waLink } from "@/lib/wa-link";
import { CurrentYear } from "./current-year";
import { Newsletter } from "./newsletter";

const groups = (whatsapp: string) => [
  {
    title: "Comprar",
    links: [
      { href: "/perfumes", label: "Todos los perfumes" },
      { href: "/perfumes?genero=Hombre", label: "Hombre" },
      { href: "/perfumes?genero=Mujer", label: "Mujer" },
      { href: "/perfumes?genero=Unisex", label: "Unisex" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: waLink(whatsapp), label: "Escríbenos por WhatsApp" },
      { href: "/seguimiento", label: "Sigue tu pedido" },
      { href: "/libro-de-reclamaciones", label: "Libro de Reclamaciones" },
      { href: "/bolsa", label: "Mi bolsa" },
      { href: "/favoritos", label: "Favoritos" },
    ],
  },
  {
    title: store.name,
    links: [{ href: "/", label: "Perfumes 100% originales" }],
  },
];

export function Footer({ whatsapp }: { whatsapp: string }) {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Newsletter />
        <div className="mt-10">
          <span className="border border-ink px-4 py-1 text-xs font-bold tracking-[0.3em]">{store.name}</span>
          <h2 className="mt-6 text-2xl">Fragancias que hablan por ti.</h2>
          <p className="mt-2 text-sm text-neutral-500">Perfumes originales elegidos con criterio para acompañar tu estilo.</p>
        </div>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {groups(whatsapp).map((g) => (
            <details key={g.title} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wider">
                {g.title}
                <span className="text-lg transition group-open:rotate-45">+</span>
              </summary>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/libro-de-reclamaciones"
            className="inline-flex items-center gap-3 border-2 border-ink bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-ink hover:text-white"
          >
            <span aria-hidden className="text-lg">📖</span> Libro de Reclamaciones
          </Link>
          <p className="text-xs text-neutral-500">
            {store.legal.name} · RUC {store.legal.ruc}
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-neutral-500">
          © <CurrentYear /> {store.name}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
