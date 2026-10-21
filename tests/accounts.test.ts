import { beforeEach, describe, expect, it, vi } from "vitest";

// Cookies en memoria: simulan el navegador del cliente.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const { handleInbound } = await import("@/server/bot");
const { CUSTOMER_COOKIE, currentCustomerId, customerFromGoogle, finishLogin, setCustomerSession, startLogin } = await import(
  "@/server/customer-auth"
);
const { validateIdToken } = await import("@/server/google");
const { hashPassword, loginWithPassword, registerWithPassword, setPassword, verifyPassword, MAX_FAILURES } = await import("@/server/passwords");
const { query, resetForTests } = await import("@/server/db");
const { OrderError } = await import("@/server/orders");
const { acceptQuote, getQuote, rejectQuote, requestQuote, sendQuote } = await import("@/server/quotes");

const lastOut = async (phone: string) => {
  const [m] = await query<{ body: string }>(
    `select m.body from wa_messages m join customers c on c.id = m.customer_id
     where c.phone = $1 and m.direction = 'out' order by m.id desc limit 1`,
    [phone],
  );
  return m?.body ?? "";
};

async function login(phone: string) {
  const { code } = await startLogin();
  await handleInbound({ from: phone, text: `ACCESO ${code}`, waId: `login-${code}` });
  expect(await finishLogin()).toBe("ok");
  return (await currentCustomerId())!;
}

beforeEach(async () => {
  jar.clear();
  await resetForTests();
});

describe("ingreso con WhatsApp", () => {
  it("el código enviado desde el WhatsApp del cliente abre la sesión de ese cliente", async () => {
    const { code } = await startLogin();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(await finishLogin()).toBe("pendiente"); // aún no llega el mensaje

    await handleInbound({ from: "51987111222", text: `ACCESO ${code.toLowerCase()}`, waId: "a1", name: "Rosa" });
    expect(await lastOut("51987111222")).toContain("Listo");

    expect(await finishLogin()).toBe("ok");
    const id = await currentCustomerId();
    const [c] = await query<{ id: number }>("select id from customers where phone = '51987111222'");
    expect(id).toBe(c.id);
  });

  it("el código es de un solo uso y vence", async () => {
    const { code } = await startLogin();
    await handleInbound({ from: "51987111222", text: `ACCESO ${code}`, waId: "b1" });
    expect(await finishLogin()).toBe("ok");
    expect(await finishLogin()).toBe("vencido"); // la cookie de ingreso ya se consumió

    // Reusar el mismo código desde otro número no sirve.
    await handleInbound({ from: "51987333444", text: `ACCESO ${code}`, waId: "b2" });
    expect(await lastOut("51987333444")).toContain("venció");

    const second = await startLogin();
    await query("update login_requests set expires_at = now() - interval '1 minute' where code = $1", [second.code]);
    await handleInbound({ from: "51987111222", text: `ACCESO ${second.code}`, waId: "b3" });
    expect(await finishLogin()).toBe("vencido");
  });

  it("una cookie de sesión alterada no da acceso", async () => {
    const id = await login("51987111222");
    const real = jar.get(CUSTOMER_COOKIE)!;
    jar.set(CUSTOMER_COOKIE, real.replace(/^\d+/, String(id + 1)));
    expect(await currentCustomerId()).toBeNull();
  });
});

describe("cotizaciones", () => {
  const variant = async (sku: string) =>
    (await query<{ id: number; price_cents: number }>("select id, price_cents from product_variants where sku = $1", [sku]))[0];

  it("pedir → cotizar → aceptar crea el pedido con los precios cotizados", async () => {
    const id = await login("51987111222");
    const asad = await variant("LAT-ASAD-100"); // S/ 119, stock 12
    const { code } = await requestQuote(id, { items: [{ variantId: asad.id, qty: 10 }], note: "Regalo corporativo" });
    expect(code).toBe("COT-1001");

    // El cliente avisa por WhatsApp.
    await handleInbound({ from: "51987111222", text: `pedí la cotización *${code}*`, waId: "q1" });
    expect(await lastOut("51987111222")).toContain("Recibimos tu solicitud");

    const quote = (await getQuote(code))!;
    await sendQuote(quote.id, { prices: { [quote.items[0].id]: 99 }, discount: 40, shipping: 15, validDays: 7, note: "Incluye caja" });
    expect(await lastOut("51987111222")).toContain("COT-1001"); // mensaje "cotización lista"
    expect((await getQuote(code))!.status).toBe("enviada");

    const order = await acceptQuote(id, code, { delivery: "tienda", payment: "plin" });
    expect(order.subtotal).toBe(990);
    const [o] = await query<{ total: number; quote_id: number }>(
      "select subtotal_cents - discount_cents + coalesce(shipping_cents, 0) as total, quote_id from orders where code = $1",
      [order.code],
    );
    expect(o.total).toBe(99000 - 4000 + 1500);
    expect((await getQuote(code))!.status).toBe("aceptada");
    const [{ reserved }] = await query<{ reserved: number }>("select reserved from product_variants where id = $1", [asad.id]);
    expect(reserved).toBe(10);

    // No se puede aceptar dos veces.
    await expect(acceptQuote(id, code, { delivery: "tienda", payment: "plin" })).rejects.toThrow(OrderError);
  });

  it("nadie puede aceptar la cotización de otro cliente", async () => {
    const owner = await login("51987111222");
    const asad = await variant("LAT-ASAD-100");
    const { code } = await requestQuote(owner, { items: [{ variantId: asad.id, qty: 2 }], note: "" });
    const quote = (await getQuote(code))!;
    await sendQuote(quote.id, { prices: { [quote.items[0].id]: 100 }, validDays: 7 });

    jar.clear();
    const intruder = await login("51987999888");
    await expect(acceptQuote(intruder, code, { delivery: "tienda", payment: "yape" })).rejects.toThrow("no encontrada");
  });

  it("una cotización vencida o rechazada ya no se acepta", async () => {
    const id = await login("51987111222");
    const asad = await variant("LAT-ASAD-100");
    const a = await requestQuote(id, { items: [{ variantId: asad.id, qty: 1 }], note: "" });
    const qa = (await getQuote(a.code))!;
    await sendQuote(qa.id, { prices: { [qa.items[0].id]: 100 }, validDays: 1 });
    await query("update quotes set valid_until = now() - interval '1 minute' where id = $1", [qa.id]);
    await expect(acceptQuote(id, a.code, { delivery: "tienda", payment: "yape" })).rejects.toThrow();
    expect((await getQuote(a.code))!.status).toBe("vencida");

    const b = await requestQuote(id, { items: [{ variantId: asad.id, qty: 1 }], note: "" });
    await rejectQuote((await getQuote(b.code))!.id, id);
    await expect(acceptQuote(id, b.code, { delivery: "tienda", payment: "yape" })).rejects.toThrow();
  });

  it("no acepta un descuento mayor al subtotal y limita cotizaciones abiertas", async () => {
    const id = await login("51987111222");
    const asad = await variant("LAT-ASAD-100");
    const { code } = await requestQuote(id, { items: [{ variantId: asad.id, qty: 1 }], note: "" });
    const quote = (await getQuote(code))!;
    await expect(sendQuote(quote.id, { prices: { [quote.items[0].id]: 50 }, discount: 60, validDays: 7 })).rejects.toThrow("descuento");
    expect((await getQuote(code))!.status).toBe("solicitada"); // no se guardó nada

    await requestQuote(id, { items: [{ variantId: asad.id, qty: 1 }], note: "" });
    await requestQuote(id, { items: [{ variantId: asad.id, qty: 1 }], note: "" });
    await expect(requestQuote(id, { items: [{ variantId: asad.id, qty: 1 }], note: "" })).rejects.toThrow("en revisión");
  });
});

describe("ingreso con Google", () => {
  const token = (claims: Record<string, unknown>) =>
    ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "firma"].join(".");
  const valid = { iss: "https://accounts.google.com", aud: "cliente-123", sub: "g-1", exp: Date.now() / 1000 + 600 };

  it("valida emisor, destinatario y vigencia del id_token", () => {
    expect(validateIdToken(token({ ...valid, email: "a@b.pe", email_verified: true }), "cliente-123")).toMatchObject({ sub: "g-1", email: "a@b.pe" });
    expect(validateIdToken(token({ ...valid, email: "a@b.pe", email_verified: false }), "cliente-123").email).toBeUndefined();
    expect(() => validateIdToken(token({ ...valid, aud: "otra-app" }), "cliente-123")).toThrow();
    expect(() => validateIdToken(token({ ...valid, iss: "https://evil.example" }), "cliente-123")).toThrow();
    expect(() => validateIdToken(token({ ...valid, exp: 1 }), "cliente-123")).toThrow();
  });

  it("crea la cuenta sin teléfono y al vincular WhatsApp nuevo queda un solo cliente", async () => {
    const g = await customerFromGoogle({ sub: "g-1", email: "ana@gmail.com", given_name: "Ana" });
    expect(g.hasPhone).toBe(false);
    expect((await customerFromGoogle({ sub: "g-1" })).id).toBe(g.id); // mismo usuario de Google → misma cuenta

    await setCustomerSession(g.id);
    const { code } = await startLogin(g.id);
    await handleInbound({ from: "51955123123", text: `ACCESO ${code}`, waId: "g-link-1" });
    expect(await finishLogin()).toBe("ok");

    const id = (await currentCustomerId())!;
    const [c] = await query<{ phone: string; google_sub: string; email: string; first_name: string }>(
      "select phone, google_sub, email, first_name from customers where id = $1",
      [id],
    );
    expect(c).toMatchObject({ phone: "51955123123", google_sub: "g-1", email: "ana@gmail.com" });
    expect(await query("select id from customers where google_sub = 'g-1'")).toHaveLength(1);
    expect((await customerFromGoogle({ sub: "g-1" })).hasPhone).toBe(true);
  });

  it("si el WhatsApp ya tenía cuenta con pedidos, Google se une a esa cuenta", async () => {
    const old = await login("51955777888"); // cliente que ya compraba por WhatsApp
    const [v] = await query<{ id: number }>("select id from product_variants where sku = 'LAT-ASAD-100'");
    await requestQuote(old, { items: [{ variantId: v.id, qty: 2 }], note: "" });

    jar.clear();
    const g = await customerFromGoogle({ sub: "g-2", given_name: "Luis" });
    await setCustomerSession(g.id);
    const { code } = await startLogin(g.id);
    await handleInbound({ from: "51955777888", text: `ACCESO ${code}`, waId: "g-link-2" });
    expect(await finishLogin()).toBe("ok");

    expect(await currentCustomerId()).toBe(old); // la sesión pasa a la cuenta con historial
    expect(await query("select id from customers where id = $1", [g.id])).toHaveLength(0); // la cuenta vacía se borró
    const [c] = await query<{ google_sub: string }>("select google_sub from customers where id = $1", [old]);
    expect(c.google_sub).toBe("g-2");
    expect(await query("select id from quotes where customer_id = $1", [old])).toHaveLength(1);
  });
});

describe("correo y contraseña", () => {

  it("guarda la contraseña cifrada y la verifica", async () => {
    const h = await hashPassword("secreta123");
    expect(h).not.toContain("secreta123");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("secreta123", h)).toBe(true);
    expect(await verifyPassword("otra-clave", h)).toBe(false);
  });

  it("registro y login; el correo no distingue mayúsculas y no se repite", async () => {
    const id = await registerWithPassword({ firstName: "Ana", email: "Ana@Correo.pe", password: "secreta123" });
    expect(await loginWithPassword("ana@correo.pe", "secreta123")).toEqual({ id, hasPhone: false });
    await expect(loginWithPassword("ana@correo.pe", "mala-clave")).rejects.toThrow("incorrectos");
    await expect(loginWithPassword("nadie@correo.pe", "secreta123")).rejects.toThrow("incorrectos"); // mismo mensaje: no revela si existe
    await expect(registerWithPassword({ firstName: "Otra", email: "ANA@correo.pe", password: "12345678" })).rejects.toThrow("Ya existe");
    await expect(registerWithPassword({ firstName: "Corta", email: "c@correo.pe", password: "123" })).rejects.toThrow();
  });

  it("bloquea el correo tras muchos intentos fallidos", async () => {
    await registerWithPassword({ firstName: "Ana", email: "ana@correo.pe", password: "secreta123" });
    for (let i = 0; i < MAX_FAILURES; i++) await expect(loginWithPassword("ana@correo.pe", `mala${i}`)).rejects.toThrow();
    await expect(loginWithPassword("ana@correo.pe", "secreta123")).rejects.toThrow("Demasiados intentos");
  }, 60_000);

  it("al vincular WhatsApp de un cliente existente, la contraseña pasa a esa cuenta", async () => {
    const old = await login("51955444333"); // ya compraba por WhatsApp
    jar.clear();
    const fresh = await registerWithPassword({ firstName: "Rosa", email: "rosa@correo.pe", password: "secreta123" });
    await setCustomerSession(fresh);
    const { code } = await startLogin(fresh);
    await handleInbound({ from: "51955444333", text: `ACCESO ${code}`, waId: "pw-link" });
    expect(await finishLogin()).toBe("ok");
    expect(await currentCustomerId()).toBe(old);
    expect(await loginWithPassword("rosa@correo.pe", "secreta123")).toEqual({ id: old, hasPhone: true });
  });

  it("olvidó la contraseña: entra con WhatsApp y pone una nueva", async () => {
    const id = await login("51955222111");
    await setPassword(id, "luis@correo.pe", "primera123");
    await setPassword(id, "luis@correo.pe", "nueva12345");
    await expect(loginWithPassword("luis@correo.pe", "primera123")).rejects.toThrow();
    expect((await loginWithPassword("luis@correo.pe", "nueva12345")).id).toBe(id);
  });
});
