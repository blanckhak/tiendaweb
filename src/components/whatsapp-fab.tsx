"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/config";
import { waLink } from "@/lib/wa-link";
import { CloseIcon, WhatsAppIcon } from "./icons";
import { useStore } from "./store-provider";

const DISMISS_KEY = "aurum.wa-bubble-dismissed";

export function WhatsAppFab() {
  const [bubble, setBubble] = useState(false);
  const { whatsapp } = useStore();
  const href = waLink(whatsapp, `Hola ${store.name}, quiero ayuda para elegir un perfume.`);

  // Saluda una vez por visita, a los 8 segundos.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;
    const t = setTimeout(() => setBubble(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setBubble(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      {bubble && (
        <div className="animate-pop relative w-64 rounded-2xl bg-white p-4 text-sm shadow-xl">
          <button onClick={close} aria-label="Cerrar" className="absolute right-2 top-2 text-neutral-400 hover:text-ink">
            <CloseIcon className="size-4" />
          </button>
          <p className="font-semibold">¿Te ayudo a elegir? 👋</p>
          <p className="mt-1 text-neutral-600">Cuéntanos qué te gusta y te recomendamos el perfume ideal.</p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#25d366] px-4 py-2 text-xs font-semibold text-white"
          >
            <WhatsAppIcon className="size-4" /> Escribir ahora
          </a>
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        className="relative grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25d366] opacity-30 motion-reduce:hidden" />
        <WhatsAppIcon className="relative size-7" />
      </a>
    </div>
  );
}
