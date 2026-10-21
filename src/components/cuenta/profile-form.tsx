"use client";

import { useState, useTransition } from "react";
import { updateProfileAction, type Profile } from "@/app/cuenta-actions";
import { departamentos } from "@/lib/config";

const input = "w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink";

function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => f.get(k)?.toString() ?? "";
        start(async () => {
          const res = await updateProfileAction({
            firstName: s("firstName"),
            lastName: s("lastName"),
            document: s("document"),
            email: s("email"),
            acceptsMarketing: f.get("acceptsMarketing") === "on",
            departamento: s("departamento"),
            provincia: s("provincia"),
            distrito: s("distrito"),
            address: s("address"),
            reference: s("reference"),
          });
          setMsg(res.ok ? { ok: true, text: "Datos guardados." } : { ok: false, text: res.error });
        });
      }}
    >
      <F label="Nombre"><input name="firstName" required defaultValue={profile.firstName} className={input} /></F>
      <F label="Apellidos"><input name="lastName" defaultValue={profile.lastName} className={input} /></F>
      <F label="DNI o CE"><input name="document" defaultValue={profile.document} className={input} /></F>
      <F label="Correo"><input name="email" type="email" defaultValue={profile.email} className={input} /></F>
      <F label="Departamento">
        <select name="departamento" defaultValue={profile.departamento} className={input}>
          <option value="">—</option>
          {departamentos.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </F>
      <F label="Provincia"><input name="provincia" defaultValue={profile.provincia} className={input} /></F>
      <F label="Distrito"><input name="distrito" defaultValue={profile.distrito} className={input} /></F>
      <F label="Dirección"><input name="address" defaultValue={profile.address} className={input} /></F>
      <F label="Referencia" className="sm:col-span-2"><input name="reference" defaultValue={profile.reference} className={input} /></F>
      <label className="flex items-start gap-2 text-xs text-neutral-600 sm:col-span-2">
        <input type="checkbox" name="acceptsMarketing" defaultChecked={profile.acceptsMarketing} className="mt-0.5 accent-ink" />
        Quiero recibir por WhatsApp novedades, recordatorios de recompra y ofertas.
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={pending} className="bg-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar datos"}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
