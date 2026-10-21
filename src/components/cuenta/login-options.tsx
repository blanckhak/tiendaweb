"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { passwordLoginAction, registerAction } from "@/app/cuenta-actions";
import { GoogleIcon } from "../icons";
import { WhatsAppLogin } from "./whatsapp-login";

const input = "w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink";

type Props = { next: string; google: boolean; onDone?: () => void };

/** Iniciar sesión / crear cuenta: correo y contraseña, WhatsApp y Google (si está configurado). */
export function LoginOptions({ next, google, onDone }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"entrar" | "crear">("entrar");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, start] = useTransition();

  // Después de entrar: si la cuenta aún no tiene WhatsApp, primero se vincula.
  const afterLogin = (hasPhone: boolean) => {
    if (onDone) return onDone();
    router.replace(hasPhone ? next : `/cuenta/vincular?next=${encodeURIComponent(next)}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 border border-line text-sm" role="tablist">
        {(["entrar", "crear"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`py-2.5 ${tab === t ? "bg-ink text-white" : "bg-white hover:bg-mist"}`}
          >
            {t === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form
        key={tab}
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const s = (k: string) => f.get(k)?.toString() ?? "";
          setError(null);
          start(async () => {
            if (tab === "entrar") {
              const res = await passwordLoginAction({ email: s("email"), password: s("password") });
              if (res.ok) afterLogin(res.data.hasPhone);
              else setError(res.error);
            } else {
              const res = await registerAction({ firstName: s("firstName"), email: s("email"), password: s("password") });
              if (res.ok) afterLogin(false);
              else setError(res.error);
            }
          });
        }}
      >
        {tab === "crear" && (
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">Nombre</span>
            <input name="firstName" required autoComplete="given-name" className={input} />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">Correo</span>
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 flex justify-between text-neutral-600">
            Contraseña
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-xs underline">
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </span>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={tab === "crear" ? 8 : undefined}
            autoComplete={tab === "crear" ? "new-password" : "current-password"}
            className={input}
          />
          {tab === "crear" && <span className="mt-1 block text-xs text-neutral-500">Mínimo 8 caracteres.</span>}
        </label>
        {error && (
          <p className="bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button disabled={pending} className="w-full bg-ink py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Un momento…" : tab === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
        {tab === "entrar" && (
          <p className="text-center text-xs text-neutral-500">
            ¿Olvidaste tu contraseña? Entra con WhatsApp aquí abajo y crea una nueva en <b>Mi cuenta</b>.
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
      </div>

      <WhatsAppLogin next={next} onDone={onDone} />

      {google && (
        <div className="text-center">
          <a
            href={`/api/auth/google?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center gap-3 border border-line bg-white px-6 py-3.5 text-sm font-semibold hover:border-ink"
          >
            <GoogleIcon className="size-5" /> Continuar con Google
          </a>
        </div>
      )}
    </div>
  );
}
