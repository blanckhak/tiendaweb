"use client";

import { useState, useTransition } from "react";
import { complaintAction } from "@/app/actions";
import { TodayDate } from "@/components/current-year";
import { store } from "@/lib/config";

const input = "w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink";

function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-line bg-white p-6">
      <legend className="px-2 text-sm font-semibold uppercase tracking-wider">{n}. {title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export default function ComplaintsBookPage() {
  const [kind, setKind] = useState<"reclamo" | "queja">("reclamo");
  const [minor, setMinor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; html: string; emailed: boolean; due: string } | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="border border-emerald-200 bg-emerald-50 p-6 print:hidden">
          <p className="text-sm text-emerald-800">Registramos tu hoja de reclamación</p>
          <p className="mt-1 text-3xl font-semibold">N° {done.code}</p>
          <p className="mt-2 text-sm text-neutral-700">
            Te responderemos a más tardar el <b>{done.due}</b>.{" "}
            {done.emailed ? "Te enviamos una copia a tu correo." : "Guarda o imprime esta constancia."}
          </p>
          <button onClick={() => window.print()} className="mt-4 bg-ink px-5 py-2.5 text-sm text-white">Imprimir / guardar PDF</button>
        </div>
        {/* El HTML lo arma el servidor con todos los datos del usuario escapados. */}
        <div className="mt-8 border border-line bg-white p-6 text-sm" dangerouslySetInnerHTML={{ __html: done.html }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center border-2 border-ink text-2xl" aria-hidden>📖</span>
        <div>
          <h1 className="text-3xl">Libro de Reclamaciones</h1>
          <p className="text-sm text-neutral-500">Hoja de reclamación virtual · Fecha: <TodayDate /></p>
        </div>
      </div>
      <div className="mt-6 bg-mist p-4 text-sm">
        <p><b>{store.legal.name}</b> · RUC {store.legal.ruc}</p>
        <p className="text-neutral-600">{store.legal.address}</p>
      </div>

      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const s = (k: string) => f.get(k)?.toString() ?? "";
          setError(null);
          start(async () => {
            const res = await complaintAction({
              fullName: s("fullName"),
              documentType: s("documentType") as "DNI",
              documentNumber: s("documentNumber"),
              address: s("address"),
              phone: s("phone"),
              email: s("email"),
              isMinor: minor,
              guardianName: s("guardianName") || undefined,
              goodType: s("goodType") as "producto",
              amount: s("amount"),
              goodDescription: s("goodDescription"),
              orderCode: s("orderCode") || undefined,
              kind,
              detail: s("detail"),
              request: s("request"),
              accepted: (f.get("accepted") === "on") as true,
            });
            if (res.ok) {
              setDone(res.data);
              window.scrollTo({ top: 0 });
            } else setError(res.error);
          });
        }}
      >
        <Section n={1} title="Identificación del consumidor">
          <F label="Nombre completo" className="sm:col-span-2"><input name="fullName" required className={input} /></F>
          <F label="Tipo de documento">
            <select name="documentType" className={input}>
              <option>DNI</option><option>CE</option><option>Pasaporte</option><option>RUC</option>
            </select>
          </F>
          <F label="Número de documento"><input name="documentNumber" required className={input} /></F>
          <F label="Domicilio" className="sm:col-span-2"><input name="address" required className={input} /></F>
          <F label="Teléfono"><input name="phone" required inputMode="tel" className={input} /></F>
          <F label="Correo electrónico"><input name="email" type="email" required className={input} /></F>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} /> Soy menor de edad
          </label>
          {minor && <F label="Nombre del padre, madre o apoderado" className="sm:col-span-2"><input name="guardianName" required className={input} /></F>}
        </Section>

        <Section n={2} title="Identificación del bien contratado">
          <F label="Tipo">
            <select name="goodType" className={input}><option value="producto">Producto</option><option value="servicio">Servicio</option></select>
          </F>
          <F label="Monto reclamado (S/, opcional)"><input name="amount" type="number" min="0" step="0.01" className={input} /></F>
          <F label="Código de pedido (opcional)"><input name="orderCode" placeholder="AUR-1001" className={input} /></F>
          <F label="Descripción del producto o servicio" className="sm:col-span-2"><input name="goodDescription" required className={input} /></F>
        </Section>

        <Section n={3} title="Detalle de la reclamación y pedido del consumidor">
          <div className="space-y-2 sm:col-span-2">
            {(["reclamo", "queja"] as const).map((k) => (
              <label key={k} className={`flex cursor-pointer gap-3 border p-3 text-sm ${kind === k ? "border-ink" : "border-line"}`}>
                <input type="radio" checked={kind === k} onChange={() => setKind(k)} className="mt-0.5 accent-ink" />
                <span>
                  <b>{k === "reclamo" ? "Reclamo" : "Queja"}:</b>{" "}
                  {k === "reclamo"
                    ? "disconformidad relacionada a los productos o servicios."
                    : "disconformidad no relacionada a los productos o servicios, o malestar respecto a la atención al público."}
                </span>
              </label>
            ))}
          </div>
          <F label="Detalle" className="sm:col-span-2"><textarea name="detail" required rows={5} className={input} /></F>
          <F label="Pedido (qué solicitas)" className="sm:col-span-2"><textarea name="request" required rows={3} className={input} /></F>
        </Section>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="accepted" required className="mt-0.5" />
          Declaro que los datos consignados son correctos y autorizo el uso de mi correo para recibir la constancia y la respuesta.
        </label>
        <p className="text-xs text-neutral-500">
          La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una
          denuncia ante el INDECOPI. El proveedor deberá dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles.
        </p>
        {error && <p className="bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <button disabled={pending} className="bg-ink px-8 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Enviar hoja de reclamación"}
        </button>
      </form>
    </div>
  );
}
