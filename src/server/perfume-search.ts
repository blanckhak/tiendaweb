import "server-only";
import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { minVariant, totalStock } from "@/lib/catalog";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { getProducts } from "./catalog";

// Búsqueda del catálogo que usan los dos asistentes con IA (WhatsApp y la web).
// Precios, stock y notas salen siempre de la base de datos: la IA nunca los inventa.

export const searchTool: BetaTool = {
  name: "buscar_perfumes",
  description:
    "Busca perfumes del catálogo con stock, precio y link. Úsala antes de mencionar cualquier perfume, precio o disponibilidad. Todos los filtros son opcionales; sin filtros devuelve el catálogo completo.",
  input_schema: {
    type: "object",
    properties: {
      texto: { type: "string", description: "Nombre, marca o nota olfativa (ej. 'vainilla', 'Lattafa')." },
      genero: { type: "string", enum: ["Hombre", "Mujer", "Unisex"] },
      familia: { type: "string", description: "Cítrico, Acuático, Frutal, Floral, Especiado, Amaderado u Oriental." },
      precio_max: { type: "number", description: "Precio máximo en soles." },
    },
    additionalProperties: false,
  },
};

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export type SearchResult = {
  slug: string;
  perfume: string;
  genero: string;
  familia: string;
  notas: string;
  presentaciones: string[];
  hay_stock: boolean;
  link: string;
};

/** Ejecuta buscar_perfumes con la entrada (sin validar) que mandó el modelo. Para la IA, máximo 8 resultados. */
export async function searchPerfumes(raw: unknown, limit = 8): Promise<SearchResult[]> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const texto = typeof input.texto === "string" ? normalize(input.texto) : "";
  const genero = typeof input.genero === "string" ? input.genero : "";
  const familia = typeof input.familia === "string" ? normalize(input.familia) : "";
  const max = typeof input.precio_max === "number" ? input.precio_max : Infinity;
  return (await getProducts())
    .filter((p) => {
      const hay = normalize([p.brand, p.name, p.family, ...p.notes.top, ...p.notes.heart, ...p.notes.base].join(" "));
      return (
        (!texto || texto.split(/\s+/).every((w) => hay.includes(w))) &&
        (!genero || p.gender === genero || p.gender === "Unisex") &&
        (!familia || normalize(p.family) === familia) &&
        minVariant(p).price <= max
      );
    })
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      perfume: `${p.brand} ${p.name}`,
      genero: p.gender,
      familia: p.family,
      notas: [...p.notes.top, ...p.notes.heart, ...p.notes.base].join(", "),
      presentaciones: p.variants.map((v) => `${v.ml} ml: ${soles(v.price)}${v.compareAt ? ` (antes ${soles(v.compareAt)})` : ""}, ${v.stock > 0 ? `${v.stock} disponibles` : "agotado"}`),
      hay_stock: totalStock(p) > 0,
      link: `${store.siteUrl}/perfumes/${p.slug}`,
    }));
}

export const searchResultJson = (found: SearchResult[]) =>
  JSON.stringify(found.length ? found : { resultado: "Sin coincidencias. Prueba con otros filtros o sin filtros." });
