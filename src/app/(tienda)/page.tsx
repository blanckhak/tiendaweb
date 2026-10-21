import Link from "next/link";
import { Bottle } from "@/components/bottle";
import { ArrowIcon } from "@/components/icons";
import { BrandMarquee } from "@/components/brand-marquee";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { discountPct } from "@/lib/catalog";
import { getFeatured, getNew, getOffers, getProducts } from "@/server/catalog";
import { store } from "@/lib/config";

function SectionHead({ kicker, title, text, cta }: { kicker: string; title: string; text: string; cta: { href: string; label: string } }) {
  return (
    <div className="max-w-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{kicker}</p>
      <h2 className="mt-3 text-3xl leading-tight md:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-neutral-500">{text}</p>
      <Link href={cta.href} className="mt-5 inline-block border border-ink px-5 py-2.5 text-sm hover:bg-ink hover:text-white">
        {cta.label}
      </Link>
    </div>
  );
}

export default async function Home() {
  const [featured, fresh, all, offers] = await Promise.all([getFeatured(), getNew(), getProducts(), getOffers()]);
  const maxOff = offers.length ? discountPct(offers[0]) : 0;
  const heroBottle = all.find((p) => p.slug === "lattafa-asad") ?? all[0];
  const campaignBottle = all.find((p) => p.slug === "lattafa-badee-al-oud-sublime") ?? all[0];

  return (
    <>
      {/* Portada */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#3a3530_0%,#111_65%)]" />
        <div className="absolute -right-10 top-10 h-[90%] opacity-40 md:right-10 md:opacity-80">
          <Bottle product={heroBottle} className="animate-float h-full" />
        </div>
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-24">
          <p className="animate-fade-up text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-300">Nueva colección</p>
          <h1 className="animate-fade-up mt-4 max-w-md text-5xl leading-[1.05] [animation-delay:120ms] md:text-6xl">Tu estilo. Tu presencia.</h1>
          <p className="animate-fade-up mt-5 max-w-md text-sm leading-relaxed text-neutral-300 [animation-delay:240ms]">
            Perfumes originales seleccionados para acompañar tu estilo y dejar una impresión que permanece.
          </p>
          <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-6 [animation-delay:360ms]">
            <Link href="/encuentra-tu-perfume" className="bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:scale-[1.03]">
              Encuentra tu perfume
            </Link>
            <Link href="/perfumes" className="inline-flex items-center gap-2 bg-white/10 px-5 py-3 text-sm backdrop-blur hover:bg-white/20">
              Descubrir perfumes <ArrowIcon className="size-4" />
            </Link>
            <Link href="#nuevos" className="text-sm underline-offset-4 hover:underline">
              Ver nuevos
            </Link>
          </div>
        </div>
      </section>

      <BrandMarquee brands={[...new Set(all.map((p) => p.brand))]} />

      {/* Ofertas: solo aparece si hay perfumes con precio normal tachado */}
      {offers.length > 0 && (
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="flex flex-wrap items-end justify-between gap-6 border-b border-gold/40 pb-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Ofertas de temporada</p>
                <h2 className="mt-3 text-4xl leading-tight md:text-5xl">
                  Hasta <span className="text-gold">-{maxOff}%</span> en perfumes originales.
                </h2>
                <p className="mt-3 max-w-md text-sm text-neutral-300">
                  Precios especiales por tiempo limitado o hasta agotar stock. El descuento ya se aplica en tu bolsa y en tu pedido.
                </p>
              </div>
              <Link
                href="/perfumes?ofertas=1"
                className="inline-flex items-center gap-2 border border-gold px-5 py-3 text-sm text-gold transition hover:bg-gold hover:text-ink"
              >
                Ver todas las ofertas <ArrowIcon className="size-4" />
              </Link>
            </div>
            {/* Las tarjetas usan el fondo claro de siempre dentro de la banda oscura */}
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 [&_h3]:text-white [&_p]:text-neutral-300">
              {offers.slice(0, 4).map((p, i) => (
                <Reveal key={p.slug} delay={i * 100}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Destacados */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
        <SectionHead
          kicker={`Selección ${store.name}`}
          title="Fragancias que destacan."
          text="Una selección de perfumes elegidos por su carácter, presencia y estilo. Encuentra opciones para diferentes momentos, personalidades y formas de expresarte."
          cta={{ href: "/perfumes", label: "Ver perfumes" }}
        />
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {featured.map((p, i) => (
            <Reveal key={p.slug} delay={i * 100}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Campaña */}
      <section className="bg-mist">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Campaña {store.name}</p>
            <h2 className="mt-3 text-4xl leading-tight">Detalles que hablan por ti.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-500">
              Fragancias elegidas para acompañar tu estilo. Piezas que completan tu presencia y hacen de cada detalle algo personal.
            </p>
            <div className="mt-6 flex items-center gap-6">
              <Link href="/perfumes" className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm text-white">
                Descubrir {store.name} <ArrowIcon className="size-4" />
              </Link>
              <Link href="/perfumes" className="text-sm underline-offset-4 hover:underline">
                Ver perfumes
              </Link>
            </div>
          </div>
          <Bottle product={campaignBottle} className="mx-auto h-80" />
        </div>
      </section>

      {/* Nuevos */}
      <section id="nuevos" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-16">
        <Reveal>
        <SectionHead
          kicker="Recién llegados"
          title={`Nuevos en ${store.name}.`}
          text="Ingresos marcados como nuevos y publicados en los últimos 60 días."
          cta={{ href: "/perfumes", label: "Ver nuevos" }}
        />
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {fresh.map((p, i) => (
            <Reveal key={p.slug} delay={i * 100}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Test interactivo */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal className="relative overflow-hidden bg-wine px-6 py-14 text-white md:px-14">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 right-24 size-40 rounded-full bg-white/5" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Test de 1 minuto</p>
          <h2 className="relative mt-3 max-w-lg text-4xl leading-tight">¿No sabes cuál elegir?</h2>
          <p className="relative mt-3 max-w-md text-sm leading-relaxed text-white/80">
            Responde 4 preguntas rápidas y te recomendamos los perfumes que van contigo. Si quieres, te asesoramos por WhatsApp.
          </p>
          <Link
            href="/encuentra-tu-perfume"
            className="relative mt-7 inline-flex items-center gap-2 bg-white px-6 py-3 text-sm font-semibold text-wine transition hover:scale-[1.03]"
          >
            Hacer el test <ArrowIcon className="size-4" />
          </Link>
        </Reveal>
      </section>

      {/* Manifiesto */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Manifiesto {store.name}</p>
          <h2 className="mt-4 max-w-xl text-4xl leading-tight">No se trata de tener más. Se trata de elegir mejor.</h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-neutral-300">
            Creemos en fragancias que dicen algo sin necesidad de explicar demasiado. Aromas que permanecen y detalles que
            completan tu presencia. {store.name} selecciona cada perfume con intención para que cada elección tenga sentido,
            carácter y lugar en tu estilo.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <Link href="/perfumes" className="bg-white px-5 py-3 text-sm text-ink">
              Descubrir {store.name}
            </Link>
            <Link href="#nuevos" className="text-sm underline-offset-4 hover:underline">
              Ver selección
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
