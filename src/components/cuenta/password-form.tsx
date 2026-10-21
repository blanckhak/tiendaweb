"use client";

import { useState, useTransition } from "react";
import { setPasswordAction } from "@/app/cuenta-actions";

const input = "w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink";

/** Crear o cambiar el correo y la contraseña para entrar sin WhatsApp. */
export function PasswordForm({ loginEmail, contactEmail }: { loginEmail: string; contactEmail: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const password = f.get("password")?.toString() ?? "";
        if (password !== f.get("confirm")?.toString()) {
          setMsg({ ok: false, text: "Las contraseñas no coinciden." });
          return;
        }
        start(async () => {
          const res = await setPasswordAction({ email: f.get("email")?.toString() ?? "", password });
          setMsg(res.ok ? { ok: true, text: "Listo. Ya puedes entrar con tu correo y contraseña." } : { ok: false, text: res.error });
          if (res.ok) form.reset();
        });
      }}
    >
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-neutral-600">Correo para iniciar sesión</span>
        <input name="email" type="email" required autoComplete="email" defaultValue={loginEmail || contactEmail} className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600">{loginEmail ? "Nueva contraseña" : "Contraseña"}</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600">Repite la contraseña</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} />
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={pending} className="bg-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : loginEmail ? "Cambiar contraseña" : "Crear contraseña"}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
