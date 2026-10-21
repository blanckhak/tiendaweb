import { store } from "@/lib/config";
import { getFeatured } from "@/server/catalog";
import { Bottle } from "../bottle";

const benefits = [
  { title: "Sigue tus pedidos", text: "Estado del pago, despacho y número de guía en un solo lugar." },
  { title: "Compra más rápido", text: "Tus datos y dirección quedan guardados para la próxima vez." },
  { title: "Cotizaciones por cantidad", text: "Precios especiales para regalos y compras al por mayor." },
];

/** Pantalla dividida para ingresar o vincular: marca a la izquierda, formulario a la derecha. */
export async function AuthShell({ kicker, title, subtitle, children }: { kicker: string; title: string; subtitle: string; children: React.ReactNode }) {
  const [hero] = await getFeatured();
  return (
    <div className="grid min-h-[calc(100vh-88px)] lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,#3a3530_0%,#111_70%)]" />
        {hero && (
          <div className="absolute -right-16 top-16 h-[70%] opacity-60">
            <Bottle product={hero} className="animate-float h-full" />
          </div>
        )}
        <div className="relative flex h-full flex-col justify-between p-12">
          <span className="w-fit border border-white/70 px-4 py-1 text-xs font-bold tracking-[0.3em]">{store.name}</span>
          <div className="max-w-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Tu cuenta {store.name}</p>
            <h2 className="mt-3 text-4xl leading-tight">Tu estilo, tus pedidos, todo en un lugar.</h2>
            <ul className="mt-10 space-y-6">
              {benefits.map((b) => (
                <li key={b.title} className="flex gap-4">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-white/40 text-xs">✓</span>
                  <span>
                    <span className="block text-sm font-semibold">{b.title}</span>
                    <span className="block text-sm text-white/65">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/50">Sin contraseñas obligatorias: entra con WhatsApp, Google o tu correo.</p>
        </div>
      </aside>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{kicker}</p>
          <h1 className="mt-2 text-4xl leading-tight">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{subtitle}</p>
          <div className="mt-8 border border-line bg-white p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)] sm:p-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
