import { soles } from "@/lib/format";
import {
  FREE_SHIPPING_FROM,
  freeShippingEnabled,
  freeShippingZones,
  missingForFreeShipping,
  qualifiesFreeShipping,
} from "@/lib/shipping";

/** Barra "te faltan S/ X para el envío gratis". */
export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  if (!freeShippingEnabled) return null;
  const missing = missingForFreeShipping(subtotal);
  const pct = Math.min(100, (subtotal / FREE_SHIPPING_FROM) * 100);
  return (
    <div className="mb-5 bg-mist p-4">
      <p className="text-sm">
        {missing > 0 ? (
          <>
            Te faltan <b>{soles(missing)}</b> para el <b>envío gratis</b> en {freeShippingZones}.
          </>
        ) : (
          <>🎉 ¡Tienes <b>envío gratis</b> a domicilio en {freeShippingZones}!</>
        )}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full transition-all duration-500 ${missing > 0 ? "bg-wine" : "bg-emerald-600"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Resumen de montos. `departamento` y `delivery` (si se conocen, en el checkout)
 * permiten mostrar el envío gratis ya aplicado.
 */
export function Totals({ subtotal, departamento, delivery }: { subtotal: number; departamento?: string; delivery?: "domicilio" | "tienda" }) {
  const free = delivery === "domicilio" && qualifiesFreeShipping(subtotal, departamento);
  const shippingLabel = delivery === "tienda" ? "Recojo gratis" : free ? "Gratis" : "Se confirma por WhatsApp";
  return (
    <>
      <FreeShippingBar subtotal={subtotal} />
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Subtotal</dt>
          <dd className="font-semibold">{soles(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Envío</dt>
          <dd className={`font-semibold ${free || delivery === "tienda" ? "text-emerald-700" : ""}`}>{shippingLabel}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-base">
          <dt>{free || delivery === "tienda" ? "Total" : "Total estimado"}</dt>
          <dd className="font-semibold">{soles(subtotal)}</dd>
        </div>
      </dl>
    </>
  );
}
