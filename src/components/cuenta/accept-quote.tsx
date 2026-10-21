"use client";

import { useState, useTransition } from "react";
import { acceptQuoteAction, rejectQuoteAction, type Profile } from "@/app/cuenta-actions";
import { departamentos, store } from "@/lib/config";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";
import { WhatsAppIcon } from "../icons";

const input = "w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink";

/** El cliente elige entrega y pago, y la cotización se convierte en pedido. */
export function AcceptQuote({ code, profile }: { code: string; profile: Profile }) {
  const [delivery, setDelivery] = useState<DeliveryMethod>("domicilio");
  const [payment, setPayment] = useState<PaymentMethod>("yape");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ order: string; url: string } | null>(null);
  const [rejected, setRejected] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm text-emerald-800">¡Cotización aceptada! Tu pedido es</p>
        <p className="mt-1 text-3xl font-semibold">{done.order}</p>
        <p className="mt-2 text-sm text-neutral-600">Tu stock queda reservado {store.reservationHours} horas. Envíanos el código para coordinar el pago.</p>
        <a href={done.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 bg-[#25d366] px-6 py-3 text-sm font-semibold text-white">
          <WhatsAppIcon className="size-5" /> Enviar por WhatsApp
        </a>
      </div>
    );
  }
  if (rejected) return <p className="text-sm text-neutral-600">Rechazaste esta cotización. Si cambias de idea, pide una nueva.</p>;

  return (
    <form
      className="space-y-5 border border-line bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => f.get(k)?.toString().trim() ?? "";
        setError(null);
        start(async () => {
          const res = await acceptQuoteAction(code, {
            delivery,
            payment,
            ...(delivery === "domicilio"
              ? { departamento: s("departamento"), provincia: s("provincia"), distrito: s("distrito"), address: s("address"), reference: s("reference") }
              : {}),
          });
          if (res.ok) setDone({ order: res.data.code, url: res.data.url });
          else setError(res.error);
        });
      }}
    >
      <h2 className="text-lg">Aceptar y hacer el pedido</h2>
      <div className="flex flex-wrap gap-3 text-sm">
        {(["domicilio", "tienda"] as const).map((d) => (
          <label key={d} className={`flex cursor-pointer items-center gap-2 border px-4 py-2 ${delivery === d ? "border-ink" : "border-line"}`}>
            <input type="radio" checked={delivery === d} onChange={() => setDelivery(d)} className="accent-ink" />
            {d === "domicilio" ? "Envío a domicilio" : "Recojo en tienda"}
          </label>
        ))}
      </div>
      {delivery === "domicilio" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="departamento" required defaultValue={profile.departamento} className={input}>
            <option value="" disabled>Departamento</option>
            {departamentos.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <input name="provincia" required placeholder="Provincia" defaultValue={profile.provincia} className={input} />
          <input name="distrito" required placeholder="Distrito" defaultValue={profile.distrito} className={input} />
          <input name="address" required placeholder="Dirección" defaultValue={profile.address} className={input} />
          <input name="reference" placeholder="Referencia (opcional)" defaultValue={profile.reference} className={`${input} sm:col-span-2`} />
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        {(["yape", "plin"] as const).map((p) => (
          <label key={p} className={`flex cursor-pointer items-center gap-2 border px-4 py-2 ${payment === p ? "border-ink" : "border-line"}`}>
            <input type="radio" checked={payment === p} onChange={() => setPayment(p)} className="accent-ink" />
            {p === "yape" ? "Yape" : "Plin"}
          </label>
        ))}
      </div>
      {error && <p className="bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className="bg-wine px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Procesando…" : "Aceptar cotización"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="text-sm underline"
          onClick={() =>
            start(async () => {
              const res = await rejectQuoteAction(code);
              if (res.ok) setRejected(true);
              else setError(res.error);
            })
          }
        >
          No me interesa
        </button>
      </div>
    </form>
  );
}
