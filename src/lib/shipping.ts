import { store } from "./config";

const { from, zones } = store.freeShipping;

export const freeShippingEnabled = from > 0 && zones.length > 0;

/** Texto corto de las zonas: "Lima y Callao". */
export const freeShippingZones = zones.length > 1 ? `${zones.slice(0, -1).join(", ")} y ${zones.at(-1)}` : (zones[0] ?? "");

/** ¿Este pedido tiene envío gratis? Solo a domicilio, en las zonas configuradas y desde el monto mínimo. */
export function qualifiesFreeShipping(subtotal: number, departamento?: string | null) {
  return freeShippingEnabled && subtotal >= from && !!departamento && zones.includes(departamento);
}

/** Cuánto falta para el envío gratis (0 si ya se alcanzó). */
export const missingForFreeShipping = (subtotal: number) => Math.max(0, from - subtotal);

export const FREE_SHIPPING_FROM = from;
