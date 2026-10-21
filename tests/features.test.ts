import { beforeEach, describe, expect, it } from "vitest";
import { qualifiesFreeShipping, missingForFreeShipping } from "@/lib/shipping";
import { whatsappMessage } from "@/lib/order";
import { addBusinessDays, createComplaint, getComplaint, respondComplaint } from "@/server/complaints";
import { query, resetForTests } from "@/server/db";
import { approvePayment, createOrder, deliverOrder, type OrderInput } from "@/server/orders";
import { approvedReviews, moderateReview, reviewableItems, submitReview } from "@/server/reviews";
import { trackOrder } from "@/server/tracking";

const variant = async (sku: string) =>
  (await query<{ id: number; product_id: number }>("select id, product_id from product_variants where sku = $1", [sku]))[0];

const input = (items: OrderInput["items"], over: Partial<OrderInput> = {}): OrderInput => ({
  firstName: "Ana",
  lastName: "Pérez",
  phone: "987654321",
  delivery: "domicilio",
  departamento: "Lima",
  provincia: "Lima",
  distrito: "Miraflores",
  address: "Calle 1",
  payment: "yape",
  items,
  ...over,
});

beforeEach(async () => {
  await resetForTests();
});

describe("envío gratis", () => {
  it("aplica desde S/ 199 solo a domicilio en Lima y Callao", () => {
    expect(qualifiesFreeShipping(199, "Lima")).toBe(true);
    expect(qualifiesFreeShipping(250, "Callao")).toBe(true);
    expect(qualifiesFreeShipping(198.9, "Lima")).toBe(false);
    expect(qualifiesFreeShipping(500, "Arequipa")).toBe(false);
    expect(missingForFreeShipping(150)).toBe(49);
  });

  it("el pedido que califica queda con envío 0 y el mensaje lo dice", async () => {
    const club = await variant("ARM-CDNI-200"); // S/ 239
    const free = await createOrder(input([{ variantId: club.id, qty: 1 }]));
    expect(free.shipping).toBe(0);
    expect(whatsappMessage({ ...free, customer: { firstName: "Ana", lastName: "P", phone: "51987654321" }, delivery: { method: "tienda" }, payment: "yape" })).toContain("gratis");

    const asad = await variant("LAT-ASAD-100"); // S/ 119: no llega
    expect((await createOrder(input([{ variantId: asad.id, qty: 1 }], { phone: "987000111" }))).shipping).toBeNull();
    // Provincia: no aplica aunque supere el monto.
    expect((await createOrder(input([{ variantId: club.id, qty: 1 }], { phone: "987000222", departamento: "Cusco" }))).shipping).toBeNull();
  });
});

describe("seguimiento sin cuenta", () => {
  it("muestra el pedido solo con el código y los 4 últimos dígitos correctos", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 2 }]));
    const found = await trackOrder(code.toLowerCase(), "4321");
    expect(found).toMatchObject({ code, status: "pendiente_pago" });
    expect(found!.items[0]).toMatchObject({ qty: 2, name: "Asad" });
    expect(JSON.stringify(found)).not.toContain("987654321"); // nunca expone el teléfono
    expect(await trackOrder(code, "0000")).toBeNull();
    expect(await trackOrder("AUR-9999", "4321")).toBeNull();
    expect(await trackOrder(code.replace("AUR-", ""), "4321")).not.toBeNull(); // acepta solo el número
  });
});

describe("reseñas", () => {
  async function deliveredOrder() {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    const [o] = await query<{ id: number; customer_id: number }>("select id, customer_id from orders where code = $1", [code]);
    return { code, orderId: o.id, customerId: o.customer_id, productId: asad.product_id };
  }

  it("solo se califica un pedido entregado, una vez por perfume, y se publica al aprobar", async () => {
    const o = await deliveredOrder();
    await expect(submitReview(o.customerId, o.code, o.productId, { rating: 5 })).rejects.toThrow("cuando recibas");

    await approvePayment(o.orderId);
    await deliverOrder(o.orderId);
    await submitReview(o.customerId, o.code, o.productId, { rating: 5, body: "Dura todo el día" });
    await expect(submitReview(o.customerId, o.code, o.productId, { rating: 4 })).rejects.toThrow("Ya calificaste");

    expect(await approvedReviews(o.productId)).toHaveLength(0); // pendiente de moderación
    const [r] = await query<{ id: number }>("select id from reviews");
    await moderateReview(r.id, "aprobada");
    const pub = await approvedReviews(o.productId);
    expect(pub[0]).toMatchObject({ rating: 5, body: "Dura todo el día", author: "Ana P." });
  });

  it("nadie puede calificar el pedido de otro cliente ni un perfume que no compró", async () => {
    const o = await deliveredOrder();
    await approvePayment(o.orderId);
    await deliverOrder(o.orderId);
    const [other] = await query<{ id: number }>("insert into customers (phone) values ('51911000222') returning id");
    expect(await reviewableItems(other.id, o.code)).toBeNull();
    await expect(submitReview(other.id, o.code, o.productId, { rating: 1 })).rejects.toThrow("no encontrado");
    const club = await variant("ARM-CDNI-105");
    await expect(submitReview(o.customerId, o.code, club.product_id, { rating: 1 })).rejects.toThrow("no está en tu pedido");
  });

  it("el mensaje de pedir reseña lleva al formulario de calificación", async () => {
    const o = await deliveredOrder();
    await approvePayment(o.orderId);
    await deliverOrder(o.orderId);
    const [job] = await query<{ payload: { link: string } }>("select payload from automation_jobs where type = 'pedir_resena'");
    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    expect(payload.link).toContain(`/cuenta/calificar/${o.code}`);
  });
});

describe("libro de reclamaciones", () => {
  const base = {
    fullName: "Rosa Quispe",
    documentType: "DNI" as const,
    documentNumber: "12345678",
    address: "Av. Arequipa 123, Lima",
    phone: "987654321",
    email: "rosa@correo.pe",
    goodType: "producto" as const,
    amount: 129,
    goodDescription: "Perfume Asad 100 ml",
    kind: "reclamo" as const,
    detail: "El perfume llegó con la caja dañada.",
    request: "Cambio de la caja o devolución.",
    accepted: true as const,
  };

  it("numera las hojas correlativamente con el año y fija el plazo en 15 días hábiles", async () => {
    const a = await createComplaint(base);
    const b = await createComplaint({ ...base, kind: "queja" });
    const year = new Date().toLocaleDateString("es-PE", { year: "numeric", timeZone: "America/Lima" });
    expect(a.complaint.code).toBe(`0001-${year}`);
    expect(b.complaint.code).toBe(`0002-${year}`);
    expect(a.emailed).toBe(false); // sin RESEND_API_KEY en pruebas
    expect(a.complaint.amount_cents).toBe(12900);
  });

  it("los días hábiles saltan sábados y domingos", () => {
    const friday = new Date("2026-10-09T12:00:00"); // viernes
    expect(addBusinessDays(friday, 1).getDay()).toBe(1); // lunes
    expect(addBusinessDays(friday, 15).toDateString()).toBe(new Date("2026-10-30T12:00:00").toDateString());
  });

  it("exige datos obligatorios y el apoderado si es menor de edad", async () => {
    await expect(createComplaint({ ...base, detail: "corto" })).rejects.toThrow();
    await expect(createComplaint({ ...base, isMinor: true })).rejects.toThrow();
    await expect(createComplaint({ ...base, isMinor: true, guardianName: "Juan Quispe" })).resolves.toBeTruthy();
  });

  it("registra la respuesta del proveedor", async () => {
    const { complaint } = await createComplaint(base);
    await respondComplaint(complaint.code, "Se coordinó el cambio de la caja sin costo.");
    expect(await getComplaint(complaint.code)).toMatchObject({ status: "respondido", response: "Se coordinó el cambio de la caja sin costo." });
  });
});
