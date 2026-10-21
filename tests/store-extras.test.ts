import { beforeEach, describe, expect, it } from "vitest";
import { discountPct } from "@/lib/catalog";
import { whatsappMessage, whatsappUrl } from "@/lib/order";
import { simpleReply, tooManyQuestions } from "@/server/assistant";
import { getOffers, getProducts } from "@/server/catalog";
import { query, resetForTests } from "@/server/db";
import { createOrder } from "@/server/orders";
import { getStoreSettings, saveStoreSettings } from "@/server/settings";

beforeEach(async () => {
  await resetForTests();
});

const customer = { firstName: "Ana", lastName: "Pérez", phone: "51987654321" };

describe("pedido por WhatsApp con ofertas", () => {
  it("el pedido guarda el precio normal de las líneas en oferta", async () => {
    const [v] = await query<{ id: number }>("select id from product_variants where sku = 'LAT-ASAD-100'"); // S/ 119, antes S/ 159
    const order = await createOrder({
      firstName: "Ana", lastName: "Pérez", phone: "987654321", delivery: "tienda", payment: "yape",
      items: [{ variantId: v.id, qty: 2 }],
    });
    expect(order.lines[0]).toMatchObject({ price: 119, compareAt: 159, qty: 2 });
  });

  it("muestra el precio tachado, el ahorro y el total a pagar", () => {
    const text = whatsappMessage({
      code: "AUR-1001",
      customer,
      delivery: { method: "tienda" },
      payment: "yape",
      lines: [
        { brand: "Lattafa", name: "Asad", ml: 100, qty: 2, price: 119, compareAt: 159 },
        { brand: "Armaf", name: "Club de Nuit", ml: 105, qty: 1, price: 200 },
      ],
      subtotal: 438,
    });
    expect(text).toContain("2 x Lattafa Asad 100 ml — S/ 238 (oferta, antes ~S/ 318~)");
    expect(text).toContain("1 x Armaf Club de Nuit 105 ml — S/ 200\n");
    expect(text).toContain("Ahorro por ofertas: S/ 80");
    expect(text).toContain("*Total a pagar: S/ 438*");
    expect(text).toContain("Nombre: Ana Pérez");
    expect(text).not.toContain("\n\n\n"); // sin huecos por líneas omitidas
  });

  it("si el envío está por confirmar, el total lo indica", () => {
    const text = whatsappMessage({
      code: "AUR-1002",
      customer,
      delivery: { method: "domicilio", departamento: "Cusco", provincia: "Cusco", distrito: "Wanchaq", address: "Av. Sol 1" },
      payment: "plin",
      lines: [{ brand: "Lattafa", name: "Asad", ml: 100, qty: 1, price: 119 }],
      subtotal: 119,
      shipping: null,
    });
    expect(text).toContain("Envío: por confirmar");
    expect(text).toContain("*Total a pagar: S/ 119 + envío*");
    expect(text).not.toContain("Ahorro");
  });

  it("el enlace va al número configurado con el mensaje codificado", () => {
    const url = whatsappUrl(
      { code: "AUR-1", customer, delivery: { method: "tienda" }, payment: "yape", lines: [], subtotal: 0 },
      "51911222333",
    );
    expect(url.startsWith("https://wa.me/51911222333?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toContain("*AUR-1*");
  });
});

describe("ajustes del panel", () => {
  it("usa el número de .env hasta que se guarda otro en el panel", async () => {
    const before = await getStoreSettings();
    expect(before.assistantEnabled).toBe(true);
    await saveStoreSettings({ whatsappNumber: "51911222333", assistantEnabled: false });
    expect(await getStoreSettings()).toEqual({ whatsappNumber: "51911222333", assistantEnabled: false });
  });
});

describe("ofertas", () => {
  it("lista solo perfumes con descuento, del mayor al menor", async () => {
    const offers = await getOffers();
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((p) => discountPct(p) > 0)).toBe(true);
    expect(offers.map(discountPct)).toEqual([...offers.map(discountPct)].sort((a, b) => b - a));
    expect(discountPct((await getProducts()).find((p) => p.slug === "lattafa-asad")!)).toBe(25); // 119 vs 159
  });
});

describe("asesor de perfumes sin IA", () => {
  it("recomienda perfumes del catálogo con stock según notas y ocasión", async () => {
    const r = await simpleReply("busco algo con vainilla para la noche");
    expect(r.slugs.length).toBeGreaterThan(0);
    const products = await getProducts();
    for (const slug of r.slugs) expect(products.find((p) => p.slug === slug)!.variants.some((v) => v.stock > 0)).toBe(true);
  });

  it("responde dudas de envío sin recomendar", async () => {
    expect(await simpleReply("¿hacen envíos a provincia?")).toMatchObject({ slugs: [] });
  });

  it("limita las preguntas por IP", async () => {
    for (let i = 0; i < 20; i++) expect(await tooManyQuestions("1.2.3.4")).toBe(false);
    expect(await tooManyQuestions("1.2.3.4")).toBe(true);
    expect(await tooManyQuestions("5.6.7.8")).toBe(false);
  });
});
