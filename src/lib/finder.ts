import { minVariant, totalStock } from "./catalog";
import type { Gender, Product } from "./types";

export type Answers = {
  para: Gender | "Regalo";
  ocasion: "dia" | "noche" | "todo";
  aroma: "fresco" | "dulce" | "intenso" | "floral";
  presupuesto: "bajo" | "medio" | "alto";
};

export const questions = [
  {
    key: "para",
    title: "¿Para quién es el perfume?",
    options: [
      { value: "Hombre", label: "Para él" },
      { value: "Mujer", label: "Para ella" },
      { value: "Unisex", label: "Para cualquiera" },
      { value: "Regalo", label: "Es un regalo, no sé" },
    ],
  },
  {
    key: "ocasion",
    title: "¿Cuándo lo vas a usar más?",
    options: [
      { value: "dia", label: "De día, oficina o universidad" },
      { value: "noche", label: "De noche, salidas y eventos" },
      { value: "todo", label: "Para todo momento" },
    ],
  },
  {
    key: "aroma",
    title: "¿Qué tipo de aroma te gusta?",
    options: [
      { value: "fresco", label: "Fresco y cítrico" },
      { value: "dulce", label: "Dulce y frutal" },
      { value: "intenso", label: "Intenso, amaderado o especiado" },
      { value: "floral", label: "Floral y suave" },
    ],
  },
  {
    key: "presupuesto",
    title: "¿Cuál es tu presupuesto?",
    options: [
      { value: "bajo", label: "Hasta S/ 130" },
      { value: "medio", label: "S/ 130 a S/ 160" },
      { value: "alto", label: "Más de S/ 160" },
    ],
  },
] as const;

const aromaFamilies: Record<Answers["aroma"], string[]> = {
  fresco: ["Cítrico", "Acuático"],
  dulce: ["Frutal"],
  intenso: ["Especiado", "Amaderado", "Oriental"],
  floral: ["Floral"],
};

const nightFamilies = ["Especiado", "Amaderado", "Oriental"];

function inBudget(price: number, b: Answers["presupuesto"]) {
  if (b === "bajo") return price <= 130;
  if (b === "medio") return price > 130 && price <= 160;
  return price > 160;
}

/** Puntúa cada perfume disponible según las respuestas y devuelve los 3 mejores. */
export function recommend(products: Product[], a: Answers): Product[] {
  return products
    .filter((p) => totalStock(p) > 0)
    .map((p) => {
      let score = 0;
      if (a.para === "Regalo" || p.gender === a.para) score += 3;
      else if (p.gender === "Unisex") score += 2;
      else score -= 4;

      if (aromaFamilies[a.aroma].includes(p.family)) score += 4;

      const isNight = nightFamilies.includes(p.family);
      if (a.ocasion === "noche" && isNight) score += 2;
      if (a.ocasion === "dia" && !isNight) score += 2;
      if (a.ocasion === "todo") score += 1;

      if (inBudget(minVariant(p).price, a.presupuesto)) score += 2;
      if (p.featured) score += 0.5;
      return { p, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((x) => x.p);
}

export function answerLabels(a: Answers) {
  return questions.map((q) => q.options.find((o) => o.value === a[q.key])?.label ?? "");
}
