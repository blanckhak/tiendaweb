import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfileAction, logoutCustomerAction } from "@/app/cuenta-actions";
import { WhatsAppIcon } from "@/components/icons";
import { PasswordForm } from "@/components/cuenta/password-form";
import { ProfileForm } from "@/components/cuenta/profile-form";
import { OrderProgress } from "@/components/order-progress";
import { soles } from "@/lib/format";
import { statusLabel, statusTone } from "@/lib/order-status";
import { displayPhone } from "@/lib/phone";
import { waLink } from "@/lib/wa-link";
import type { OrderStatus } from "@/lib/types";
import { currentCustomerId } from "@/server/customer-auth";
import { query } from "@/server/db";
import { listQuotes, quoteStatusLabel, quoteTotals } from "@/server/quotes";
import { getStoreSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
      <Suspense fallback={<div className="min-h-[70vh] animate-pulse bg-mist" />}>
        <Account />
      </Suspense>
    </div>
  );
}

type Order = {
  code: string;
  status: OrderStatus;
  total_cents: number;
  shipping_cents: number | null;
  courier: string | null;
  tracking_number: string | null;
  created_at: Date;
  items: string;
};

const date = (d: Date) => new Date(d).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Lima" });

const nav = [
  { href: "#pedidos", label: "Mis pedidos" },
  { href: "#cotizaciones", label: "Cotizaciones" },
  { href: "#datos", label: "Datos y dirección" },
  { href: "#seguridad", label: "Acceso y seguridad" },
];

function Card({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border border-line bg-white p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

async function Account() {
  const id = await currentCustomerId();
  if (!id) redirect("/cuenta/ingresar");
  const [profile, orders, quotes, { whatsappNumber: whatsapp }] = await Promise.all([
    getProfileAction(),
    query<Order>(
      `select o.code, o.status, o.courier, o.tracking_number, o.created_at, o.shipping_cents,
              o.subtotal_cents - o.discount_cents + coalesce(o.shipping_cents, 0) as total_cents,
              (select string_agg(oi.qty || ' × ' || oi.brand || ' ' || oi.name, ' · ' order by oi.id) from order_items oi where oi.order_id = o.id) as items
       from orders o where o.customer_id = $1 order by o.created_at desc limit 50`,
      [id],
    ),
    listQuotes({ customerId: id }),
    getStoreSettings(),
  ]);
  if (!profile) redirect("/cuenta/ingresar");

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Cliente";
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const active = orders.filter((o) => !["entregado", "cancelado", "vencido"].includes(o.status)).length;
  const openQuotes = quotes.filter((q) => q.status === "solicitada" || q.status === "enviada").length;
  const methods = [
    { label: "WhatsApp", on: !!profile.phone, detail: profile.phone ? displayPhone(profile.phone) : "Sin vincular" },
    { label: "Correo y contraseña", on: !!profile.loginEmail, detail: profile.loginEmail || "No configurado" },
    { label: "Google", on: profile.google, detail: profile.google ? "Conectado" : "No conectado" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* Menú lateral */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="border border-line bg-white p-6">
          <div className="flex items-center gap-4 lg:flex-col lg:items-start">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-wine text-xl font-semibold text-white">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{name}</p>
              <p className="text-sm text-neutral-500">{profile.phone ? `WhatsApp ${displayPhone(profile.phone)}` : "WhatsApp sin vincular"}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.phone && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">✓ WhatsApp verificado</span>}
            {profile.google && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800">Google</span>}
            {profile.loginEmail && <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">Contraseña</span>}
          </div>
          <nav className="mt-6 hidden border-t border-line pt-4 lg:block">
            <ul className="space-y-1 text-sm">
              {nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="block px-2 py-2 hover:bg-mist">{n.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <form action={logoutCustomerAction} className="mt-4 border-t border-line pt-4">
            <button className="px-2 text-sm text-neutral-500 hover:text-ink">Cerrar sesión</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 space-y-8">
        {/* Bienvenida */}
        <section className="relative overflow-hidden bg-ink p-6 text-white sm:p-8">
          <div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/5" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Mi cuenta</p>
          <h1 className="relative mt-2 text-3xl sm:text-4xl">Hola, {profile.firstName || "bienvenido"}</h1>
          <dl className="relative mt-6 grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
            <div><dt className="text-xs text-white/60">Pedidos</dt><dd className="mt-1 text-2xl font-semibold">{orders.length}</dd></div>
            <div><dt className="text-xs text-white/60">En curso</dt><dd className="mt-1 text-2xl font-semibold">{active}</dd></div>
            <div><dt className="text-xs text-white/60">Cotizaciones abiertas</dt><dd className="mt-1 text-2xl font-semibold">{openQuotes}</dd></div>
          </dl>
        </section>

        {!profile.phone && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-amber-50 p-5 text-sm">
            <p><b>Falta un paso:</b> vincula tu WhatsApp para confirmar pedidos y pedir cotizaciones.</p>
            <Link href="/cuenta/vincular" className="inline-flex items-center gap-2 bg-[#25d366] px-4 py-2 font-semibold text-white">
              <WhatsAppIcon className="size-4" /> Vincular WhatsApp
            </Link>
          </div>
        )}

        <Card id="pedidos" title="Mis pedidos" aside={<Link href="/perfumes" className="text-sm underline">Seguir comprando</Link>}>
          {orders.length === 0 ? (
            <div className="bg-mist p-8 text-center">
              <p className="text-sm text-neutral-600">Aún no tienes pedidos.</p>
              <Link href="/perfumes" className="mt-4 inline-block bg-ink px-6 py-3 text-sm text-white">Ver perfumes</Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((o) => (
                <li key={o.code} className="border border-line p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{o.code}</p>
                      <p className="text-xs text-neutral-500">{date(o.created_at)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[o.status]}`}>{statusLabel[o.status]}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-neutral-600">{o.items}</p>
                  <OrderProgress status={o.status} />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                    <p>
                      Total <b>{soles(o.total_cents / 100)}</b>
                      {o.shipping_cents === null && <span className="text-neutral-500"> + envío</span>}
                    </p>
                    {o.status === "entregado" ? (
                      <Link href={`/cuenta/calificar/${o.code}`} className="inline-flex items-center gap-1.5 font-semibold text-amber-700 underline">
                        ★ Calificar mi compra
                      </Link>
                    ) : o.tracking_number ? (
                      <p className="text-neutral-600">{o.courier} · Guía <b>{o.tracking_number}</b></p>
                    ) : o.status === "pendiente_pago" ? (
                      <a
                        href={waLink(whatsapp, `Hola, quiero pagar mi pedido *${o.code}*`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-700 underline"
                      >
                        <WhatsAppIcon className="size-4" /> Enviar comprobante
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="cotizaciones" title="Mis cotizaciones" aside={<Link href="/cotizar" className="border border-ink px-4 py-2 text-sm hover:bg-ink hover:text-white">Pedir cotización</Link>}>
          {quotes.length === 0 ? (
            <p className="text-sm text-neutral-600">¿Compras por cantidad o para regalar? Arma tu bolsa y pide una cotización: te respondemos por WhatsApp.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {quotes.map((q) => (
                <li key={q.code}>
                  <Link href={`/cuenta/cotizaciones/${q.code}`} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm hover:bg-mist">
                    <div>
                      <p className="font-semibold">{q.code}</p>
                      <p className="text-xs text-neutral-500">{date(q.created_at)} · {q.items.reduce((s, i) => s + i.qty, 0)} unidades</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${q.status === "enviada" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-700"}`}>
                      {quoteStatusLabel[q.status]}
                    </span>
                    <p className="font-semibold">{q.status === "solicitada" ? "Por cotizar" : soles(quoteTotals(q).total / 100)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="datos" title="Datos y dirección">
          <p className="-mt-3 mb-6 text-sm text-neutral-500">Se usan para completar tus próximos pedidos automáticamente.</p>
          <ProfileForm profile={profile} />
        </Card>

        <Card id="seguridad" title="Acceso y seguridad">
          <ul className="mb-8 grid gap-3 sm:grid-cols-3">
            {methods.map((m) => (
              <li key={m.label} className={`border p-4 ${m.on ? "border-emerald-200 bg-emerald-50/50" : "border-line"}`}>
                <p className="text-sm font-semibold">{m.on ? "✓ " : ""}{m.label}</p>
                <p className="mt-1 truncate text-xs text-neutral-500">{m.detail}</p>
              </li>
            ))}
          </ul>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            {profile.loginEmail ? "Cambiar contraseña" : "Crear contraseña (opcional)"}
          </h3>
          <PasswordForm loginEmail={profile.loginEmail} contactEmail={profile.email} />
        </Card>
      </div>
    </div>
  );
}
