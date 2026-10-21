import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog } from "@/components/catalog";
import { getProducts } from "@/server/catalog";

export const metadata: Metadata = { title: "Perfumes" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function CatalogWithParams({ searchParams }: Pick<PageProps<"/perfumes">, "searchParams">) {
  const sp = await searchParams;
  const products = await getProducts();
  return (
    <Catalog
      // La clave reinicia los filtros cuando se navega desde el menú o el buscador.
      key={JSON.stringify(sp)}
      products={products}
      initial={{ q: one(sp.q), genero: one(sp.genero), ofertas: one(sp.ofertas) === "1" }}
    />
  );
}

export default function PerfumesPage({ searchParams }: PageProps<"/perfumes">) {
  return (
    <Suspense fallback={<div className="mx-auto min-h-[60vh] max-w-6xl px-4 py-10" />}>
      <CatalogWithParams searchParams={searchParams} />
    </Suspense>
  );
}
