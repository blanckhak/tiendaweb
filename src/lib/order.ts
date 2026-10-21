import { store } from "./config";
import { soles } from "./format";
import type { DeliveryMethod, PaymentMethod } from "./types";
import { waLink } from "./wa-link";

/** price: precio unitario cobrado. compareAt: precio normal por unidad si la línea está en oferta. */
export type OrderLine = { brand: string; name: string; ml: number; qty: number; price: number; compareAt?: number };

export type OrderDraft = {
  code: string;
  customer: { firstName: string; lastName: string; phone: string; document?: string; email?: string };
  delivery:
    | { method: Extract<DeliveryMethod, "tienda"> }
    | {
        method: Extract<DeliveryMethod, "domicilio">;
        departamento: string;
        provincia: string;
        distrito: string;
        address: string;
        reference?: string;
      };
  payment: PaymentMethod;
  lines: OrderLine[];
  subtotal: number;
  /** 0 = gratis; null o ausente = por confirmar. */
  shipping?: number | null;
};

export function whatsappMessage(o: OrderDraft) {
  // En WhatsApp ~texto~ se ve tachado: el cliente ve el precio normal y el de oferta.
  const items = o.lines.map(
    (l) =>
      `• ${l.qty} x ${l.brand} ${l.name} ${l.ml} ml — ${soles(l.price * l.qty)}` +
      (l.compareAt ? ` (oferta, antes ~${soles(l.compareAt * l.qty)}~)` : ""),
  );
  const savings = o.lines.reduce((s, l) => s + (l.compareAt ? (l.compareAt - l.price) * l.qty : 0), 0);
  // El total se conoce si el envío ya tiene costo (o es gratis) o si recoge en tienda.
  const shippingKnown = o.delivery.method === "tienda" || typeof o.shipping === "number";
  const total = o.subtotal + (o.delivery.method === "domicilio" && o.shipping ? o.shipping : 0);
  const delivery =
    o.delivery.method === "tienda"
      ? `Recojo en tienda (${store.pickupAddress})`
      : [
          "Envío a domicilio:",
          `${o.delivery.address}, ${o.delivery.distrito}, ${o.delivery.provincia}, ${o.delivery.departamento}`,
          o.delivery.reference ? `Ref.: ${o.delivery.reference}` : "",
        ]
          .filter(Boolean)
          .join("\n");

  return [
    `Hola ${store.name}, quiero confirmar mi pedido *${o.code}*`,
    "",
    ...items,
    "",
    `Subtotal: *${soles(o.subtotal)}*`,
    savings > 0 ? `Ahorro por ofertas: ${soles(savings)}` : null,
    o.shipping === 0
      ? "Envío: *gratis* 🎉"
      : o.delivery.method === "tienda"
        ? null
        : o.shipping
          ? `Envío: ${soles(o.shipping)}`
          : "Envío: por confirmar",
    shippingKnown ? `*Total a pagar: ${soles(total)}*` : `*Total a pagar: ${soles(total)} + envío*`,
    "",
    delivery,
    `Pago: ${o.payment === "yape" ? "Yape" : "Plin"}`,
    "",
    `Nombre: ${o.customer.firstName} ${o.customer.lastName}`,
    `Teléfono: ${o.customer.phone}`,
    o.customer.document ? `Documento: ${o.customer.document}` : null,
  ]
    // null = línea omitida; "" = separador (sin dos seguidos).
    .filter((line): line is string => line !== null)
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}

/** phone: número de WhatsApp del negocio (se configura en Panel → Ajustes). */
export const whatsappUrl = (o: OrderDraft, phone: string) => waLink(phone, whatsappMessage(o));
