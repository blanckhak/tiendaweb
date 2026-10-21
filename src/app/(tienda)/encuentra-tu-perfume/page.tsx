import type { Metadata } from "next";
import { PerfumeFinder } from "@/components/perfume-finder";
import { getProducts } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Encuentra tu perfume",
  description: "Responde 4 preguntas y descubre qué perfume va contigo.",
};

export default async function FinderPage() {
  return <PerfumeFinder products={await getProducts()} />;
}
