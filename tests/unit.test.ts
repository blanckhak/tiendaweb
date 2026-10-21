import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { recommend, type Answers } from "@/lib/finder";
import { whatsappMessage } from "@/lib/order";
import { normalizePhone } from "@/lib/phone";
import type { Product } from "@/lib/types";
import { render } from "@/server/automations";
import { seedProducts } from "@/server/seed";
import { verifySignature } from "@/server/whatsapp";

const catalog: Product[] = seedProducts.map((p, i) => ({
  ...p,
  id: i + 1,
  variants: p.variants.map((v, j) => ({ ...v, id: (i + 1) * 10 + j })),
}));

describe("normalizePhone", () => {
  it("agrega el código de Perú a un celular de 9 dígitos", () => {
    expect(normalizePhone("987 654 321")).toBe("51987654321");
    expect(normalizePhone("+51 987-654-321")).toBe("51987654321");
  });
  it("rechaza números incompletos", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("test Encuentra tu perfume", () => {
  const base: Answers = { para: "Hombre", ocasion: "noche", aroma: "intenso", presupuesto: "medio" };

  it("recomienda 3 perfumes con stock", () => {
    const r = recommend(catalog, base);
    expect(r).toHaveLength(3);
    expect(r.every((p) => p.variants.some((v) => v.stock > 0))).toBe(true);
  });

  it("no recomienda perfumes de mujer a quien busca para él", () => {
    expect(recommend(catalog, base).some((p) => p.gender === "Mujer")).toBe(false);
  });

  it("prioriza la familia olfativa elegida", () => {
    const [first] = recommend(catalog, { ...base, aroma: "fresco", ocasion: "dia" });
    expect(["Cítrico", "Acuático"]).toContain(first.family);
  });

  it("nunca recomienda un perfume agotado", () => {
    const r = recommend(catalog, { para: "Hombre", ocasion: "noche", aroma: "intenso", presupuesto: "bajo" });
    expect(r.map((p) => p.slug)).not.toContain("afnan-9pm"); // stock 0 en los datos de ejemplo
  });
});

describe("mensaje de WhatsApp del checkout", () => {
  it("incluye código, productos, total y entrega", () => {
    const text = whatsappMessage({
      code: "AUR-1001",
      customer: { firstName: "Ana", lastName: "Pérez", phone: "51987654321" },
      delivery: { method: "domicilio", departamento: "Lima", provincia: "Lima", distrito: "Miraflores", address: "Calle 1" },
      payment: "plin",
      lines: [{ brand: "Lattafa", name: "Asad", ml: 100, qty: 2, price: 119 }],
      subtotal: 238,
    });
    expect(text).toContain("*AUR-1001*");
    expect(text).toContain("2 x Lattafa Asad 100 ml — S/ 238");
    expect(text).toContain("Pago: Plin");
    expect(text).toContain("Calle 1, Miraflores, Lima, Lima");
  });
});

describe("plantillas de automatización", () => {
  it("reemplaza las variables y limpia espacios sobrantes", () => {
    const text = render("Hola {nombre}, tu pedido *{codigo}* va con {agencia}. Guía: {guia}", {
      customer: { id: 1, phone: "51987654321", first_name: "Ana", last_inbound_at: null, accepts_marketing: false },
      order: { id: 1, code: "AUR-1001", status: "despachado", total_cents: 25800, payment_method: "yape", courier: "Olva", tracking_number: "123" },
    });
    expect(text).toBe("Hola Ana, tu pedido *AUR-1001* va con Olva. Guía: 123");
  });
  it("sin nombre no deja una coma suelta", () => {
    const text = render("Hola {nombre}, gracias", {
      customer: { id: 1, phone: "51987654321", first_name: "", last_inbound_at: null, accepts_marketing: false },
    });
    expect(text).toBe("Hola, gracias");
  });
});

describe("firma del webhook de Meta", () => {
  const body = JSON.stringify({ hello: "world" });
  const sig = "sha256=" + createHmac("sha256", "secreto").update(body).digest("hex");

  it("acepta la firma correcta", () => {
    expect(verifySignature(body, sig, "secreto")).toBe(true);
  });
  it("rechaza firma alterada, ausente o de otro cuerpo", () => {
    expect(verifySignature(body, sig.replace(/.$/, "0"), "secreto")).toBe(false);
    expect(verifySignature(body, null, "secreto")).toBe(false);
    expect(verifySignature(body + " ", sig, "secreto")).toBe(false);
  });
});
