"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { finishLoginAction, startLoginAction } from "@/app/cuenta-actions";
import { WhatsAppIcon } from "../icons";

type State = { step: "inicio" } | { step: "esperando"; code: string; url: string } | { step: "vencido" };

/** Ingreso sin contraseña: el cliente envía un código por WhatsApp y la página se abre sola. */
export function WhatsAppLogin({ next, link = false, onDone }: { next: string; link?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "inicio" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Mientras espera, pregunta cada 2,5 s si el mensaje ya llegó.
  useEffect(() => {
    if (state.step !== "esperando") return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const res = await finishLoginAction();
      if (stop) return;
      if (res === "ok") {
        if (onDone) return onDone();
        router.replace(next);
        router.refresh();
      } else if (res === "vencido") {
        setState({ step: "vencido" });
      } else {
        timer = setTimeout(tick, 2500);
      }
    };
    let timer = setTimeout(tick, 2500);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [state, next, router, onDone]);

  const begin = () =>
    start(async () => {
      setError(null);
      const res = await startLoginAction({ link });
      if (!res.ok) return setError(res.error);
      setState({ step: "esperando", ...res.data });
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });

  if (state.step === "esperando") {
    return (
      <div className="text-center">
        <p className="text-sm text-neutral-600">Envía este mensaje desde tu WhatsApp:</p>
        <p className="mt-3 inline-block rounded-md border border-line bg-white px-5 py-3 font-mono text-2xl tracking-[0.25em]">
          ACCESO {state.code}
        </p>
        <div className="mt-6">
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25d366] px-6 py-3.5 text-sm font-semibold text-white"
          >
            <WhatsAppIcon className="size-5" /> Abrir WhatsApp
          </a>
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-neutral-500">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Esperando tu mensaje… esta página se abrirá sola.
        </p>
        <p className="mt-2 text-xs text-neutral-400">El código vence en 10 minutos.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      {state.step === "vencido" && (
        <p className="mb-4 text-sm text-amber-700">El código venció. Genera uno nuevo.</p>
      )}
      <button
        onClick={begin}
        disabled={pending}
        className="inline-flex items-center gap-2 bg-[#25d366] px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <WhatsAppIcon className="size-5" /> {pending ? "Generando código…" : link ? "Vincular mi WhatsApp" : "Entrar con WhatsApp"}
      </button>
      {!link && <p className="mt-4 text-xs text-neutral-500">Sin contraseñas. Si es tu primera vez, tu cuenta se crea sola.</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
