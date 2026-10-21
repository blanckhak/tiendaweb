import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { store } from "@/lib/config";

const nav = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/cotizaciones", label: "Cotizaciones" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/resenas", label: "Reseñas" },
  { href: "/admin/chats", label: "Chats de WhatsApp" },
  { href: "/admin/automatizaciones", label: "Automatizaciones" },
  { href: "/admin/simulador", label: "Simulador de WhatsApp" },
  { href: "/admin/reclamaciones", label: "Libro de Reclamaciones" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export const metadata = { title: "Panel", robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 md:flex-row">
      <aside className="border-b border-line bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 md:block">
          <Link href="/admin" className="border border-ink px-3 py-1 text-xs font-bold tracking-[0.3em]">
            {store.name}
          </Link>
          <p className="text-xs text-neutral-500 md:mt-2">Panel de administración</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-neutral-100">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden space-y-1 border-t border-line p-3 md:block">
          <Link href="/" target="_blank" className="block rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            Ver tienda ↗
          </Link>
          <form action={logoutAction}>
            <button className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-100">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
