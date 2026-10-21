import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductImage } from "@/components/product-image";
import { ProductCard } from "@/components/product-card";
import { ProductPurchase } from "@/components/product-purchase";
import { Stars } from "@/components/stars";
import { soles } from "@/lib/format";
import { minVariant } from "@/lib/catalog";
import { approvedReviews } from "@/server/reviews";
import { publicUrl } from "@/server/storage";
import { getProduct, getProducts } from "@/server/catalog";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/perfumes/[slug]">): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const price = soles(minVariant(p).price);
  // Título y descripción de la tarjeta al compartir el link (la imagen sale de opengraph-image.tsx).
  return {
    title: `${p.name} — ${p.brand}`,
    description: p.description,
    openGraph: { title: `${p.brand} ${p.name} · ${price}`, description: p.description, type: "website" },
  };
}

export default function ProductPage({ params }: PageProps<"/perfumes/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6" />}>
      <ProductDetail params={params} />
    </Suspense>
  );
}

async function ProductDetail({ params }: Pick<PageProps<"/perfumes/[slug]">, "params">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const reviews = await approvedReviews(product.id);
  const related = (await getProducts())
    .filter((p) => p.slug !== slug && (p.family === product.family || p.gender === product.gender))
    .slice(0, 4);

  const notes = [
    { label: "Salida", items: product.notes.top },
    { label: "Corazón", items: product.notes.heart },
    { label: "Fondo", items: product.notes.base },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav className="text-xs text-neutral-500">
        <Link href="/">Inicio</Link> / <Link href="/perfumes">Perfumes</Link> /{" "}
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden bg-mist">
          <ProductImage product={product} />
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{product.brand}</p>
          <h1 className="mt-2 text-4xl leading-tight">{product.name} Eau de Parfum</h1>
          {product.rating && (
            <a href="#resenas" className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-600 hover:underline">
              <Stars value={product.rating.avg} /> {product.rating.avg.toFixed(1)} · {product.rating.count}{" "}
              {product.rating.count === 1 ? "reseña" : "reseñas"}
            </a>
          )}
          <p className="mt-4 text-sm leading-relaxed text-neutral-600">{product.description}</p>

          <ProductPurchase product={product} />

          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6 text-sm">
            {notes.map((n) => (
              <div key={n.label}>
                <dt className="text-[11px] uppercase tracking-wider text-neutral-500">{n.label}</dt>
                <dd className="mt-1">{n.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-neutral-500">
            Familia: {product.family} · Género: {product.gender}
          </p>
        </div>
      </div>

      <section id="resenas" className="mt-20 scroll-mt-32">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl">Opiniones de clientes</h2>
            <p className="mt-1 text-sm text-neutral-500">Solo publican quienes compraron y recibieron este perfume.</p>
          </div>
          {product.rating && (
            <p className="flex items-center gap-3">
              <span className="text-4xl font-semibold">{product.rating.avg.toFixed(1)}</span>
              <span>
                <Stars value={product.rating.avg} size="text-lg" />
                <span className="block text-xs text-neutral-500">{product.rating.count} {product.rating.count === 1 ? "reseña" : "reseñas"}</span>
              </span>
            </p>
          )}
        </div>
        {reviews.length === 0 ? (
          <p className="mt-6 bg-mist p-6 text-sm text-neutral-600">Aún no hay opiniones. ¿Lo compraste? Califícalo desde Mi cuenta.</p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className="border border-line bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <Stars value={r.rating} />
                  <span className="text-xs text-neutral-500">
                    {new Date(r.created_at).toLocaleDateString("es-PE", { month: "short", year: "numeric", timeZone: "America/Lima" })}
                  </span>
                </div>
                {r.body && <p className="mt-3 text-sm leading-relaxed">{r.body}</p>}
                {r.photo_key && (
                  // eslint-disable-next-line @next/next/no-img-element -- foto subida por el cliente
                  <img src={publicUrl(r.photo_key)} alt="Foto del cliente" loading="lazy" className="mt-3 h-40 w-full object-cover" />
                )}
                <p className="mt-3 text-xs font-semibold">{r.author} · <span className="font-normal text-emerald-700">✓ Compra verificada</span></p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl">También te puede gustar</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
