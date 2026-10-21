"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { assistantAction } from "@/app/actions";
import { minVariant } from "@/lib/catalog";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { CloseIcon, SparkleIcon } from "./icons";
import { ProductImage } from "./product-image";
import { useStore } from "./store-provider";

type Msg = { role: "user" | "assistant"; text: string; slugs?: string[]; error?: boolean };

const KEY = "aurum.asesor.v1";
const SUGGESTIONS = ["Algo fresco para la oficina", "Para una cita de noche", "Regalo para ella hasta S/ 150", "¿Hacen envíos a provincia?"];

/** Texto con los links (https://...) clicables. */
function Linkified({ text }: { text: string }) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} className="break-all underline" target={part.startsWith(store.siteUrl) ? undefined : "_blank"} rel="noopener noreferrer">
        {part.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      part
    ),
  );
}

function Suggested({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const { index, add } = useStore();
  const [added, setAdded] = useState(false);
  const p = index[slug];
  if (!p) return null;
  const v = minVariant(p);
  const inStock = p.variants.some((x) => x.stock > 0);
  return (
    <div className="flex gap-3 border border-line bg-white p-2">
      <Link href={`/perfumes/${slug}`} onClick={onOpen} className="relative size-16 shrink-0 overflow-hidden bg-mist">
        <ProductImage product={p} />
      </Link>
      <div className="min-w-0 flex-1 text-xs">
        <Link href={`/perfumes/${slug}`} onClick={onOpen} className="block">
          <span className="block uppercase tracking-wider text-neutral-500">{p.brand}</span>
          <span className="block truncate text-sm text-ink">{p.name}</span>
        </Link>
        <span className="font-semibold">{soles(v.price)}</span>
        {v.compareAt && <span className="ml-1.5 text-neutral-400 line-through">{soles(v.compareAt)}</span>}
        <span className="text-neutral-500"> · {v.ml} ml</span>
      </div>
      {inStock && v.stock > 0 && (
        <button
          onClick={() => {
            add(slug, v.ml, 1);
            setAdded(true);
          }}
          disabled={added}
          className="self-center whitespace-nowrap border border-ink px-2.5 py-1.5 text-[11px] font-semibold hover:bg-ink hover:text-white disabled:border-line disabled:bg-transparent disabled:text-emerald-700"
        >
          {added ? "✓ En tu bolsa" : "Agregar"}
        </button>
      )}
    </div>
  );
}

/** Asesor de perfumes con IA: botón flotante (abajo a la izquierda; WhatsApp va a la derecha) y panel de chat. */
export function AssistantChat() {
  const { assistant } = useStore();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // La conversación se mantiene durante la visita (sessionStorage): se lee al abrir el panel
  // y se guarda solo después, para no pisar la guardada con la lista vacía del primer render.
  const loaded = useRef(false);
  const openChat = () => {
    if (!loaded.current) {
      loaded.current = true;
      try {
        const saved = sessionStorage.getItem(KEY);
        if (saved) setMsgs(JSON.parse(saved) as Msg[]);
      } catch {}
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20)));
    } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, pending]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!assistant) return null;

  const send = (text: string) => {
    const clean = text.trim().slice(0, 800);
    if (!clean || pending) return;
    const next: Msg[] = [...msgs, { role: "user", text: clean }];
    setMsgs(next);
    setDraft("");
    startTransition(async () => {
      // Al servidor solo viajan los turnos válidos, los últimos 20, empezando por el cliente.
      const turns = next.filter((m) => !m.error).map(({ role, text }) => ({ role, text })).slice(-20);
      while (turns[0]?.role === "assistant") turns.shift();
      try {
        const res = await assistantAction(turns);
        setMsgs((m) => [...m, res.ok ? { role: "assistant", text: res.data.text, slugs: res.data.slugs } : { role: "assistant", text: res.error, error: true }]);
      } catch {
        setMsgs((m) => [...m, { role: "assistant", text: "No pude responder ahora. Inténtalo de nuevo en un momento.", error: true }]);
      }
    });
  };

  return (
    <>
      {!open && (
        <button
          onClick={openChat}
          aria-label="Abrir asesor de perfumes"
          className="fixed bottom-5 left-5 z-30 flex items-center gap-2 rounded-full bg-ink py-3 pl-3.5 pr-4 text-sm font-semibold text-white shadow-lg ring-1 ring-gold/60 transition hover:scale-105"
        >
          <SparkleIcon className="size-5 text-gold" />
          <span className="hidden sm:inline">Asesor de perfumes</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Asesor de perfumes"
          className="animate-pop fixed inset-x-4 bottom-4 z-40 flex h-[min(620px,calc(100dvh-2rem))] flex-col overflow-hidden border border-line bg-[#fafaf8] shadow-2xl sm:inset-x-auto sm:left-5 sm:w-[400px]"
        >
          <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <span className="grid size-9 place-items-center rounded-full border border-gold/60">
              <SparkleIcon className="size-5 text-gold" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Asesor {store.name}</p>
              <p className="text-[11px] text-neutral-400">Recomendaciones con IA · precios y stock reales</p>
            </div>
            {msgs.length > 0 && (
              <button onClick={() => setMsgs([])} className="text-[11px] text-neutral-400 underline hover:text-white">
                Nueva consulta
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-neutral-400 hover:text-white">
              <CloseIcon className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="max-w-[85%] bg-white p-3 text-sm shadow-sm">
              ¡Hola! Soy tu asesor de perfumes. Cuéntame qué aromas te gustan, para qué ocasión lo buscas o tu presupuesto, y te recomiendo los ideales. ✨
            </div>
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="border border-line bg-white px-3 py-1.5 text-xs hover:border-ink">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-line bg-ink px-3 py-2 text-sm text-white">
                  {m.text}
                </p>
              ) : (
                <div key={i} className="max-w-[92%] space-y-2">
                  <p className={`whitespace-pre-line p-3 text-sm shadow-sm ${m.error ? "bg-red-50 text-red-700" : "bg-white"}`}>
                    <Linkified text={m.text} />
                  </p>
                  {m.slugs?.map((slug) => <Suggested key={slug} slug={slug} onOpen={() => setOpen(false)} />)}
                </div>
              ),
            )}
            {pending && (
              <p className="flex w-fit gap-1 bg-white p-3 shadow-sm" aria-label="Escribiendo">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex gap-2 border-t border-line bg-white p-3"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={800}
              placeholder="Ej.: algo dulce para la noche"
              aria-label="Escribe tu consulta"
              className="min-w-0 flex-1 border border-line px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <button disabled={pending || !draft.trim()} className="bg-ink px-4 text-sm font-semibold text-white disabled:opacity-40">
              Enviar
            </button>
          </form>
          <p className="bg-white px-3 pb-2 text-center text-[10px] text-neutral-400">
            El asesor usa IA y puede equivocarse. Precios y stock se confirman al hacer tu pedido.
          </p>
        </section>
      )}
    </>
  );
}
