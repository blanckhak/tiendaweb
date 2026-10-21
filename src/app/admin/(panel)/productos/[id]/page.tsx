import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm, type ProductFormData } from "@/components/admin/product-form";
import { Loading, PageTitle, btnGhost } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth";
import { query } from "@/server/db";
import { publicUrl } from "@/server/storage";

export default function ProductPage({ params, searchParams }: PageProps<"/admin/productos/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Product params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type ProductRow = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  gender: string;
  family: string;
  description: string;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  featured: boolean;
  is_new: boolean;
  active: boolean;
  colors: ProductFormData["colors"] | string;
  image_key: string | null;
};

type VariantRow = { id: number; ml: number; sku: string; price_cents: number; compare_at_cents: number | null; stock: number; reserved: number };

async function Product({ params, searchParams }: Pick<PageProps<"/admin/productos/[id]">, "params" | "searchParams">) {
  await requireAdmin();
  const { id } = await params;
  const saved = (await searchParams).guardado === "1";
  let data: ProductFormData | null = null;

  if (id !== "nuevo") {
    if (!/^\d+$/.test(id)) notFound();
    const [p] = await query<ProductRow>("select * from products where id = $1", [Number(id)]);
    if (!p) notFound();
    const variants = await query<VariantRow>(
      "select id, ml, sku, price_cents, compare_at_cents, stock, reserved from product_variants where product_id = $1 order by ml",
      [p.id],
    );
    data = {
      id: p.id,
      slug: p.slug,
      brand: p.brand,
      name: p.name,
      gender: p.gender,
      family: p.family,
      description: p.description,
      notesTop: p.notes_top.join(", "),
      notesHeart: p.notes_heart.join(", "),
      notesBase: p.notes_base.join(", "),
      featured: p.featured,
      isNew: p.is_new,
      active: p.active,
      colors: typeof p.colors === "string" ? JSON.parse(p.colors) : p.colors,
      image: p.image_key ? publicUrl(p.image_key) : undefined,
      variants: variants.map((v) => ({
        id: v.id,
        ml: v.ml,
        sku: v.sku,
        price: v.price_cents / 100,
        compareAt: v.compare_at_cents ? v.compare_at_cents / 100 : undefined,
        stock: v.stock,
        reserved: v.reserved,
      })),
    };
  }

  return (
    <>
      <PageTitle aside={<Link href="/admin/productos" className={btnGhost}>← Productos</Link>}>
        {data ? `${data.brand} ${data.name}` : "Nuevo perfume"}
      </PageTitle>
      {saved && <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Guardado. La tienda ya muestra los cambios.</p>}
      <ProductForm product={data} />
    </>
  );
}
