"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { createOrderAction } from "@/app/actions";
import { sessionInfoAction, type Profile } from "@/app/cuenta-actions";
import { LoginOptions } from "@/components/cuenta/login-options";
import { WhatsAppLogin } from "@/components/cuenta/whatsapp-login";
import { ProductImage } from "@/components/product-image";
import { WhatsAppIcon } from "@/components/icons";
import { useStore } from "@/components/store-provider";
import { Totals } from "@/components/totals";
import { departamentos, store } from "@/lib/config";
import { soles } from "@/lib/format";
import { whatsappUrl, type OrderDraft } from "@/lib/order";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

const input = "w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function Step({ n, title, text, children }: { n: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <div className="flex gap-3">
        <span className="grid size-7 shrink-0 place-items-center border border-line text-xs">{n}</span>
        <div>
          <h2 className="text-lg">{title}</h2>
          <p className="text-xs text-neutral-500">{text}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Option({ checked, onChange, title, text }: { checked: boolean; onChange: () => void; title: string; text: string }) {
  return (
    <label className={`flex cursor-pointer gap-3 border p-4 ${checked ? "border-ink bg-white" : "border-line"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 accent-ink" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-neutral-500">{text}</span>
      </span>
    </label>
  );
}

export default function CheckoutPage() {
  const { ready, lines, subtotal, clear, index: productIndex, whatsapp } = useStore();
  const [delivery, setDelivery] = useState<DeliveryMethod>("domicilio");
  const [payment, setPayment] = useState<PaymentMethod>("yape");
  const [order, setOrder] = useState<OrderDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Para confirmar hay que tener cuenta: el formulario se completa con los datos guardados.
  const [session, setSession] = useState<{ profile: Profile | null; google: boolean } | null>(null);
  const loadSession = useCallback(() => {
    sessionInfoAction().then(setSession).catch(() => setSession({ profile: null, google: false }));
  }, []);
  useEffect(loadSession, [loadSession]);
  const profile = session?.profile ?? null;
  // Departamento elegido (o el guardado en la cuenta): el resumen muestra al instante si el envío sale gratis.
  const [chosenDepartamento, setDepartamento] = useState<string | null>(null);
  const departamento = chosenDepartamento ?? profile?.departamento ?? "";
  const pf = (k: keyof Profile) => (profile ? String(profile[k] ?? "") : undefined);

  if (order) {
    const url = whatsappUrl(order, whatsapp);
    const pay = store.payments[order.payment];
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Pedido registrado</p>
        <h1 className="mt-3 text-4xl">{order.code}</h1>
        <p className="mt-4 text-sm text-neutral-600">
          ¡Tu pedido quedó registrado y tu stock reservado por {store.reservationHours} horas! Envíanos el código por
          WhatsApp: te confirmamos el envío y los datos de pago.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2 bg-[#25d366] px-6 py-3.5 text-sm font-semibold text-white"
        >
          <WhatsAppIcon className="size-5" /> Enviar pedido por WhatsApp
        </a>
        <div className="mt-8 border border-line bg-white p-5 text-left text-sm">
          <p className="font-semibold">Pago con {order.payment === "yape" ? "Yape" : "Plin"}</p>
          <p className="mt-1 text-neutral-600">
            {pay.holder} · {pay.number}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            {order.shipping === 0 || order.delivery.method === "tienda" ? (
              <>
                Total a pagar: <b>{soles(order.subtotal)}</b>
                {order.shipping === 0 && " (envío gratis)"}. Envía la captura del comprobante en el chat de WhatsApp.
              </>
            ) : (
              <>
                Total productos: {soles(order.subtotal)} + envío. Paga solo cuando te confirmemos el total por WhatsApp y
                envía la captura del comprobante en el mismo chat.
              </>
            )}
          </p>
        </div>
        <Link href="/perfumes" className="mt-8 inline-block text-sm underline">
          Seguir comprando
        </Link>
      </div>
    );
  }

  if (!ready) return null;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-neutral-500">Tu bolsa está vacía.</p>
        <Link href="/perfumes" className="mt-4 inline-block bg-ink px-6 py-3 text-sm text-white">
          Ver perfumes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Aurum / Checkout seguro</p>
      <h1 className="mt-2 text-4xl">Finaliza tu pedido</h1>

      {!session ? (
        <div className="mt-8 h-40 animate-pulse bg-mist" />
      ) : !profile ? (
        <div className="mx-auto mt-10 max-w-md border border-line bg-white p-8">
          <h2 className="text-center text-xl">Para confirmar tu pedido, entra o crea tu cuenta</h2>
          <p className="mt-2 text-center text-sm text-neutral-500">
            Tu bolsa se mantiene. Con tu cuenta ves el estado del pedido y la próxima vez compras más rápido.
          </p>
          <div className="mt-8">
            <LoginOptions next="/checkout" google={session.google} onDone={loadSession} />
          </div>
        </div>
      ) : !profile.phone ? (
        <div className="mx-auto mt-10 max-w-md border border-line bg-white p-8">
          <h2 className="text-center text-xl">Vincula tu WhatsApp para confirmar</h2>
          <p className="mt-2 mb-8 text-center text-sm text-neutral-500">
            Por ahí te confirmamos el pedido, los datos de pago y el envío. Solo se hace una vez.
          </p>
          <WhatsAppLogin next="/checkout" link onDone={loadSession} />
        </div>
      ) : (
      <form
        key={profile ? "con-cuenta" : "invitado"}
        className="mt-8 grid gap-10 md:grid-cols-[1fr_360px]"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const s = (k: string) => f.get(k)?.toString().trim() ?? "";
          const customer = {
            firstName: s("firstName"),
            lastName: s("lastName"),
            phone: s("phone"),
            document: s("document") || undefined,
            email: s("email") || undefined,
          };
          const address = {
            departamento: s("departamento"),
            provincia: s("provincia"),
            distrito: s("distrito"),
            address: s("address"),
            reference: s("reference") || undefined,
          };
          setError(null);
          startTransition(async () => {
            const res = await createOrderAction({
              ...customer,
              ...(delivery === "domicilio" ? address : {}),
              acceptsMarketing: f.get("acceptsMarketing") === "on",
              delivery,
              payment,
              items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            // El mensaje de WhatsApp usa los precios confirmados por el servidor.
            setOrder({
              code: res.data.code,
              customer,
              delivery: delivery === "tienda" ? { method: "tienda" } : { method: "domicilio", ...address },
              payment,
              lines: res.data.lines,
              subtotal: res.data.subtotal,
              shipping: res.data.shipping,
            });
            clear();
            window.scrollTo({ top: 0 });
          });
        }}
      >
        <div>
          <Step n="01" title="Contacto" text="Datos de tu cuenta. Puedes corregirlos aquí; el WhatsApp es el verificado.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <input name="firstName" required defaultValue={pf("firstName")} className={input} autoComplete="given-name" />
              </Field>
              <Field label="Apellidos">
                <input name="lastName" required defaultValue={pf("lastName")} className={input} autoComplete="family-name" />
              </Field>
              <Field label="Teléfono (WhatsApp)">
                <input
                  name="phone"
                  required
                  inputMode="tel"
                  readOnly
                  title="Es el WhatsApp verificado de tu cuenta"
                  defaultValue={profile.phone.replace(/^51/, "")}
                  className={`${input} bg-neutral-50 text-neutral-600`}
                  autoComplete="tel"
                />
              </Field>
              <Field label="DNI o CE (opcional)">
                <input name="document" inputMode="numeric" defaultValue={pf("document")} className={input} />
              </Field>
              <Field label="Correo (opcional)">
                <input name="email" type="email" defaultValue={pf("email")} className={input} autoComplete="email" />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-xs text-neutral-600">
              <input type="checkbox" name="acceptsMarketing" defaultChecked={profile?.acceptsMarketing} className="mt-0.5 accent-ink" />
              Quiero recibir por WhatsApp novedades, recordatorios de recompra y ofertas. Puedo darme de baja cuando quiera.
            </label>
          </Step>

          <Step n="02" title="Entrega" text="El costo de envío se confirma por WhatsApp según tu ubicación.">
            <Option
              checked={delivery === "domicilio"}
              onChange={() => setDelivery("domicilio")}
              title="Envío a domicilio"
              text="A todo el Perú. Lima por motorizado; provincias por agencia."
            />
            <Option
              checked={delivery === "tienda"}
              onChange={() => setDelivery("tienda")}
              title="Recojo en tienda"
              text={store.pickupAddress}
            />
            {delivery === "domicilio" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Departamento">
                  <select
                    name="departamento"
                    required
                    defaultValue={pf("departamento") ?? ""}
                    onChange={(e) => setDepartamento(e.target.value)}
                    className={input}
                  >
                    <option value="" disabled>
                      Selecciona
                    </option>
                    {departamentos.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Provincia">
                  <input name="provincia" required defaultValue={pf("provincia")} className={input} />
                </Field>
                <Field label="Distrito">
                  <input name="distrito" required defaultValue={pf("distrito")} className={input} />
                </Field>
                <Field label="Dirección">
                  <input name="address" required defaultValue={pf("address")} className={input} autoComplete="street-address" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Referencia (opcional)">
                    <input name="reference" defaultValue={pf("reference")} className={input} />
                  </Field>
                </div>
              </div>
            )}
          </Step>

          <Step n="03" title="Pago" text="Los pagos se validan manualmente con la captura del comprobante.">
            <Option
              checked={payment === "yape"}
              onChange={() => setPayment("yape")}
              title="Yape"
              text={store.payments.yape.number}
            />
            <Option
              checked={payment === "plin"}
              onChange={() => setPayment("plin")}
              title="Plin"
              text={store.payments.plin.number}
            />
          </Step>
        </div>

        <aside className="h-fit border border-line bg-white p-5 md:sticky md:top-32">
          <h2 className="text-sm font-semibold">Resumen</h2>
          <ul className="my-4 space-y-3">
            {lines.map((l) => (
              <li key={`${l.slug}-${l.ml}`} className="flex gap-3 text-sm">
                <div className="relative size-14 shrink-0 overflow-hidden bg-mist">
                  <ProductImage product={productIndex[l.slug]} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-neutral-500">{l.brand}</p>
                  <p>{l.name}</p>
                  <p className="text-xs text-neutral-500">
                    {l.ml} ml · {l.qty} x {soles(l.price)}
                  </p>
                </div>
                <p className="font-semibold">{soles(l.qty * l.price)}</p>
              </li>
            ))}
          </ul>
          <Totals subtotal={subtotal} departamento={departamento} delivery={delivery} />
          {error && <p className="mt-4 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button
            disabled={pending}
            className="mt-5 flex w-full items-center justify-center gap-2 bg-wine py-3.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <WhatsAppIcon className="size-5" /> {pending ? "Registrando pedido…" : "Confirmar pedido"}
          </button>
          <p className="mt-3 text-xs text-neutral-500">
            Al confirmar reservamos tu stock {store.reservationHours} horas y te llevamos a WhatsApp para coordinar envío y pago.
          </p>
        </aside>
      </form>
      )}
    </div>
  );
}
