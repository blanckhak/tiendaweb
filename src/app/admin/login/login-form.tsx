"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm({ withEmail }: { withEmail: boolean }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <div className="grid min-h-screen place-items-center bg-neutral-50 px-4">
      <form action={action} className="w-full max-w-sm rounded-lg border border-line bg-white p-8">
        <h1 className="text-xl font-semibold">Panel de administración</h1>
        <p className="mt-1 text-sm text-neutral-500">{withEmail ? "Ingresa con tu correo y contraseña." : "Ingresa la contraseña del negocio."}</p>
        {withEmail && (
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="username"
            placeholder="Correo"
            className="mt-6 w-full rounded-md border border-line px-3 py-2.5 text-sm outline-none focus:border-ink"
          />
        )}
        <input
          type="password"
          name="password"
          required
          autoFocus={!withEmail}
          autoComplete="current-password"
          placeholder="Contraseña"
          className={`${withEmail ? "mt-3" : "mt-6"} w-full rounded-md border border-line px-3 py-2.5 text-sm outline-none focus:border-ink`}
        />
        {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
        <button disabled={pending} className="mt-4 w-full rounded-md bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
