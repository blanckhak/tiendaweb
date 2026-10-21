import { beforeEach, describe, expect, it } from "vitest";
import { runDueJobs } from "@/server/automations";
import { handleInbound } from "@/server/bot";
import { query, resetForTests } from "@/server/db";
import { approvePayment, cancelOrder, createOrder, deliverOrder, OrderError, rejectPayment, shipOrder, type OrderInput } from "@/server/orders";

async function variant(sku: string) {
  const [v] = await query<{ id: number; stock: number; reserved: number; price_cents: number }>(
    "select id, stock, reserved, price_cents from product_variants where sku = $1",
    [sku],
  );
  return v;
}

async function order(code: string) {
  const [o] = await query<{ id: number; status: string; customer_id: number }>("select id, status, customer_id from orders where code = $1", [code]);
  return o;
}

const outbound = (customerId: number) =>
  query<{ body: string; author: string }>("select body, author from wa_messages where customer_id = $1 and direction = 'out' order by id", [customerId]);

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

describe("crear pedido", () => {
  it("reserva el stock, usa precios del servidor y numera AUR-1001", async () => {
    const asad = await variant("LAT-ASAD-100"); // stock 12, S/ 119
    const created = await createOrder(input([{ variantId: asad.id, qty: 2 }]));

    expect(created.code).toBe("AUR-1001");
    expect(created.subtotal).toBe(238);
    expect((await variant("LAT-ASAD-100")).reserved).toBe(2);
    expect((await variant("LAT-ASAD-100")).stock).toBe(12); // el stock físico baja recién al pagar

    const jobs = await query<{ type: string }>("select type from automation_jobs order by type");
    expect(jobs.map((j) => j.type)).toEqual(["pedido_vencido", "recordatorio_pago", "ultimo_aviso_pago"]);
  });

  it("no permite vender más de lo disponible (contando reservas)", async () => {
    const badee = await variant("LAT-BAOS-100"); // stock 3
    await createOrder(input([{ variantId: badee.id, qty: 2 }]));
    await expect(createOrder(input([{ variantId: badee.id, qty: 2 }], { phone: "987000111" }))).rejects.toThrow(OrderError);
    await expect(createOrder(input([{ variantId: badee.id, qty: 2 }], { phone: "987000111" }))).rejects.toThrow("Solo quedan 1");
  });

  it("rechaza un perfume agotado y datos inválidos", async () => {
    const nine = await variant("AFN-9PM-100"); // stock 0
    await expect(createOrder(input([{ variantId: nine.id, qty: 1 }]))).rejects.toThrow("se agotó");
    await expect(createOrder(input([{ variantId: nine.id, qty: 1 }], { phone: "123" }))).rejects.toThrow();
    await expect(createOrder(input([{ variantId: nine.id, qty: 1 }], { address: "" }))).rejects.toThrow();
  });
});

describe("ciclo del pedido", () => {
  it("comprobante → aprobación → despacho → entrega, con mensajes al cliente", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    const o = await order(code);

    // El cliente llega por WhatsApp con el código: el bot responde con los datos de pago.
    await handleInbound({ from: "51987654321", text: `Hola, quiero confirmar mi pedido *${code}*`, waId: "w1" });
    expect((await outbound(o.customer_id)).at(-1)?.body).toContain("Recibimos tu pedido");

    // Envía la captura del comprobante.
    await handleInbound({ from: "51987654321", waId: "w2", kind: "image", media: { data: Buffer.from("fake"), contentType: "image/jpeg" } });
    expect((await order(code)).status).toBe("pago_en_revision");
    expect((await outbound(o.customer_id)).at(-1)?.body).toContain("Recibimos tu comprobante");

    // Meta reenvía el mismo mensaje: no se procesa dos veces.
    await handleInbound({ from: "51987654321", waId: "w2", kind: "image", media: { data: Buffer.from("fake"), contentType: "image/jpeg" } });
    expect(await query("select id from payments")).toHaveLength(1);

    await approvePayment(o.id);
    expect((await order(code)).status).toBe("pagado");
    expect(await variant("LAT-ASAD-100")).toMatchObject({ stock: 11, reserved: 0 });
    expect((await outbound(o.customer_id)).at(-1)?.body).toContain("Pago confirmado");

    await shipOrder(o.id, "Olva", "ABC123");
    expect((await outbound(o.customer_id)).at(-1)?.body).toContain("ABC123");

    await deliverOrder(o.id);
    expect((await order(code)).status).toBe("entregado");
    const later = await query<{ type: string }>("select type from automation_jobs where status = 'pendiente' order by type");
    expect(later.map((j) => j.type)).toEqual(["pedir_resena", "recompra"]);
  });

  it("un comprobante rechazado vuelve a pendiente de pago y avisa", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    await handleInbound({ from: "51987654321", waId: "x1", media: { data: Buffer.from("x"), contentType: "image/png" } });
    const o = await order(code);
    await rejectPayment(o.id);
    expect((await order(code)).status).toBe("pendiente_pago");
    expect((await outbound(o.customer_id)).at(-1)?.body).toContain("no pudimos validar");
  });

  it("cancelar libera la reserva; cancelar ya pagado devuelve el stock", async () => {
    const asad = await variant("LAT-ASAD-100");
    const a = await createOrder(input([{ variantId: asad.id, qty: 3 }]));
    await cancelOrder((await order(a.code)).id);
    expect(await variant("LAT-ASAD-100")).toMatchObject({ stock: 12, reserved: 0 });

    const b = await createOrder(input([{ variantId: asad.id, qty: 2 }]));
    await approvePayment((await order(b.code)).id);
    expect((await variant("LAT-ASAD-100")).stock).toBe(10);
    await cancelOrder((await order(b.code)).id);
    expect((await variant("LAT-ASAD-100")).stock).toBe(12);
  });
});

describe("automatizaciones", () => {
  it("vence el pedido sin pago y libera el stock", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 4 }]));
    await query("update automation_jobs set run_at = now() - interval '1 minute'");
    const results = await runDueJobs();
    expect(results.map((r) => r.type).sort()).toEqual(["pedido_vencido", "recordatorio_pago", "ultimo_aviso_pago"]);
    expect((await order(code)).status).toBe("vencido");
    expect((await variant("LAT-ASAD-100")).reserved).toBe(0);
  });

  it("no recuerda el pago de un pedido que ya se pagó", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    await approvePayment((await order(code)).id);
    await query("update automation_jobs set run_at = now() - interval '1 minute'");
    expect(await runDueJobs()).toEqual([]);
    const jobs = await query<{ status: string }>("select status from automation_jobs");
    expect(jobs.every((j) => j.status === "omitido")).toBe(true);
  });

  it("al enviar revisa de nuevo el estado del pedido", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    // El pedido cambió por otro camino (p. ej. el comprobante llegó) antes del recordatorio.
    await query("update orders set status = 'pago_en_revision' where code = $1", [code]);
    await query("update automation_jobs set run_at = now() - interval '1 minute' where type = 'recordatorio_pago'");
    const [r] = await runDueJobs();
    expect(r.result).toContain("omitido");
  });

  it("sin la ventana de 24 h ni plantilla de Meta, el mensaje se omite (no se pierde en silencio)", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    // El cliente nunca escribió por WhatsApp: no hay ventana de servicio.
    await query("update automation_jobs set run_at = now() - interval '1 minute' where type = 'recordatorio_pago'");
    const [r] = await runDueJobs();
    expect(r.result).toContain("24 h");
    expect((await order(code)).status).toBe("pendiente_pago");
  });

  it("los mensajes promocionales respetan el consentimiento", async () => {
    const asad = await variant("LAT-ASAD-100");
    const { code } = await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    const o = await order(code);
    await approvePayment(o.id);
    await deliverOrder(o.id);
    await handleInbound({ from: "51987654321", text: "gracias!", waId: "g1" }); // abre la ventana de 24 h
    await query("update automation_jobs set run_at = now() - interval '1 minute' where type = 'pedir_resena'");
    const [r] = await runDueJobs();
    expect(r.result).toContain("no aceptó");
  });
});

describe("bot sin IA", () => {
  it("responde con el menú y no responde si una persona atiende el chat", async () => {
    await handleInbound({ from: "51911222333", text: "hola", waId: "m1", name: "Luis" });
    const [c] = await query<{ id: number }>("select id from customers where phone = '51911222333'");
    expect((await outbound(c.id)).at(-1)?.body).toContain("Soy el asistente");

    await query("update customers set bot_paused = true where id = $1", [c.id]);
    await handleInbound({ from: "51911222333", text: "¿precio?", waId: "m2" });
    expect(await outbound(c.id)).toHaveLength(1);
  });
});

describe("protecciones", () => {
  it("limita los pedidos sin pagar por número", async () => {
    const asad = await variant("LAT-ASAD-100");
    for (let i = 0; i < 3; i++) await createOrder(input([{ variantId: asad.id, qty: 1 }]));
    await expect(createOrder(input([{ variantId: asad.id, qty: 1 }]))).rejects.toThrow("pedidos pendientes");
    // Otro número sí puede comprar.
    await expect(createOrder(input([{ variantId: asad.id, qty: 1 }], { phone: "987000222" }))).resolves.toBeTruthy();
  });

  it("el bot deja de responder al pasar el tope por hora y deriva a una persona", async () => {
    await handleInbound({ from: "51955000111", text: "hola", waId: "r0" });
    const [c] = await query<{ id: number }>("select id from customers where phone = '51955000111'");
    await query(
      "insert into wa_messages (customer_id, direction, author, body, status) select $1, 'out', 'bot', 'x', 'simulado' from generate_series(1, 29)",
      [c.id],
    );
    await handleInbound({ from: "51955000111", text: "otra vez", waId: "r1" });
    const [{ bot_paused }] = await query<{ bot_paused: boolean }>("select bot_paused from customers where id = $1", [c.id]);
    expect(bot_paused).toBe(true);
  });
});
