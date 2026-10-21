"use client";

import { useState } from "react";
import { store } from "@/lib/config";
import { answerLabels, questions, recommend, type Answers } from "@/lib/finder";
import type { Product } from "@/lib/types";
import { waLink } from "@/lib/wa-link";
import { WhatsAppIcon } from "./icons";
import { ProductCard } from "./product-card";
import { useStore } from "./store-provider";

export function PerfumeFinder({ products }: { products: Product[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const { whatsapp: phone } = useStore();

  const done = step >= questions.length;
  const results = done ? recommend(products, answers as Answers) : [];

  const whatsapp = () => {
    const labels = answerLabels(answers as Answers);
    const text = [
      `Hola ${store.name}, hice el test "Encuentra tu perfume":`,
      ...questions.map((q, i) => `• ${q.title} ${labels[i]}`),
      "",
      `Me recomendó: ${results.map((p) => `${p.brand} ${p.name}`).join(", ")}.`,
      "¿Me ayudan a elegir?",
    ].join("\n");
    return waLink(phone, text);
  };

  const restart = () => {
    setAnswers({});
    setStep(0);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        Test de 1 minuto
      </p>
      <h1 className="mt-2 text-center text-4xl">Encuentra tu perfume</h1>

      {/* Progreso */}
      <div className="mx-auto mt-8 flex max-w-sm gap-1.5" aria-hidden>
        {questions.map((q, i) => (
          <span
            key={q.key}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i < step ? "bg-ink" : "bg-line"}`}
          />
        ))}
      </div>

      {!done ? (
        <div key={step} className="animate-fade-up mt-10">
          <p className="text-center text-xs text-neutral-500">
            Pregunta {step + 1} de {questions.length}
          </p>
          <h2 className="mt-2 text-center text-2xl">{questions[step].title}</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {questions[step].options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setAnswers((a) => ({ ...a, [questions[step].key]: o.value }));
                  setStep((s) => s + 1);
                }}
                className="border border-line bg-white px-5 py-4 text-left text-sm transition hover:-translate-y-0.5 hover:border-ink hover:shadow-md active:scale-[0.98]"
              >
                {o.label}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="mx-auto mt-6 block text-sm underline">
              Volver
            </button>
          )}
        </div>
      ) : (
        <div className="animate-fade-up mt-10">
          <h2 className="text-center text-2xl">Estos perfumes van contigo</h2>
          <p className="mt-2 text-center text-sm text-neutral-500">
            Elegidos según tus respuestas. ¿Dudas? Te asesoramos por WhatsApp.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3">
            {results.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center gap-4">
            <a
              href={whatsapp()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25d366] px-6 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              <WhatsAppIcon className="size-5" /> Quiero asesoría por WhatsApp
            </a>
            <button onClick={restart} className="text-sm underline">
              Hacer el test de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
