import type { SeedProduct } from "@/lib/types";
import type { Query } from "./db";

// Datos iniciales: se cargan solo si la tabla de productos está vacía.
export const seedProducts: SeedProduct[] = [
  {
    slug: "lattafa-badee-al-oud-sublime",
    brand: "Lattafa",
    name: "Bade'e Al Oud Sublime",
    gender: "Unisex",
    family: "Frutal",
    description:
      "Una fragancia frutal, dulce y envolvente que combina manzana, lichi y rosa con un corazón de ciruela y jazmín, sobre un fondo cálido de vainilla, musgo y pachulí.",
    notes: { top: ["Manzana", "Lichi", "Limón"], heart: ["Rosa", "Ciruela", "Jazmín"], base: ["Vainilla", "Musgo", "Pachulí"] },
    featured: true,
    colors: { glass: "#7a1f2b", cap: "#c9a45c", liquid: "#a8323f" },
    variants: [{ ml: 100, sku: "LAT-BAOS-100", price: 129, compareAt: 149, stock: 3 }],
  },
  {
    slug: "lattafa-asad",
    brand: "Lattafa",
    name: "Asad",
    gender: "Hombre",
    family: "Especiado",
    description:
      "Intenso y especiado: pimienta negra y tabaco abren paso a un corazón de café e iris, con un fondo ambarado de vainilla y benjuí.",
    notes: { top: ["Pimienta negra", "Tabaco", "Piña"], heart: ["Café", "Iris", "Pachulí"], base: ["Ámbar", "Vainilla", "Benjuí"] },
    featured: true,
    colors: { glass: "#1c1c1c", cap: "#c9a45c", liquid: "#3a2a1a" },
    variants: [{ ml: 100, sku: "LAT-ASAD-100", price: 119, compareAt: 159, stock: 12 }],
  },
  {
    slug: "lattafa-yara-moi",
    brand: "Lattafa",
    name: "Yara Moi",
    gender: "Mujer",
    family: "Floral",
    description:
      "Floral y luminosa, con jazmín y durazno sobre un fondo suave de ámbar y almizcle. Ideal para el día.",
    notes: { top: ["Durazno", "Jazmín"], heart: ["Caramelo", "Rosa"], base: ["Ámbar", "Almizcle", "Pachulí"] },
    isNew: true,
    colors: { glass: "#e9e4dc", cap: "#d8c9a8", liquid: "#f1d9c6" },
    variants: [{ ml: 100, sku: "LAT-YMOI-100", price: 139, compareAt: 159, stock: 2 }],
  },
  {
    slug: "lattafa-asad-bourbon",
    brand: "Lattafa",
    name: "Asad Bourbon",
    gender: "Hombre",
    family: "Amaderado",
    description:
      "Una versión más cálida de Asad: notas de bourbon y canela sobre maderas ahumadas y vainilla.",
    notes: { top: ["Canela", "Pimienta rosa"], heart: ["Bourbon", "Lavanda"], base: ["Vainilla", "Maderas ahumadas"] },
    isNew: true,
    colors: { glass: "#5a2e1f", cap: "#8a6a3c", liquid: "#7a3e22" },
    variants: [{ ml: 100, sku: "LAT-ASBO-100", price: 169, stock: 8 }],
  },
  {
    slug: "armaf-club-de-nuit-intense",
    brand: "Armaf",
    name: "Club de Nuit Intense",
    gender: "Hombre",
    family: "Cítrico",
    description:
      "Cítrico y ahumado, con piña y grosella negra en la salida y un fondo de abedul y almizcle. Uno de los más pedidos.",
    notes: { top: ["Limón", "Piña", "Grosella negra"], heart: ["Abedul", "Jazmín", "Rosa"], base: ["Almizcle", "Ámbar gris", "Vainilla"] },
    featured: true,
    colors: { glass: "#111111", cap: "#b8b8b8", liquid: "#2b2b2b" },
    variants: [
      { ml: 105, sku: "ARM-CDNI-105", price: 159, compareAt: 189, stock: 10 },
      { ml: 200, sku: "ARM-CDNI-200", price: 239, stock: 4 },
    ],
  },
  {
    slug: "armaf-mandarin-sky",
    brand: "Armaf",
    name: "Mandarin Sky",
    gender: "Hombre",
    family: "Cítrico",
    description:
      "Mandarina jugosa y caramelo sobre un fondo de haba tonka y ámbar. Dulce, fresco y muy versátil.",
    notes: { top: ["Mandarina", "Naranja amarga"], heart: ["Caramelo", "Azafrán"], base: ["Haba tonka", "Ámbar", "Vetiver"] },
    isNew: true,
    colors: { glass: "#1e88b4", cap: "#f08a24", liquid: "#3aa6d0" },
    variants: [{ ml: 100, sku: "ARM-MSKY-100", price: 149, compareAt: 169, stock: 6 }],
  },
  {
    slug: "lattafa-qaed-al-fursan",
    brand: "Lattafa",
    name: "Qaed Al Fursan",
    gender: "Unisex",
    family: "Frutal",
    description:
      "Piña y azafrán sobre un corazón floral y un fondo de oud y ámbar. Llamativo y con buena duración.",
    notes: { top: ["Piña", "Azafrán"], heart: ["Jazmín", "Rosa"], base: ["Oud", "Ámbar", "Musgo"] },
    isNew: true,
    colors: { glass: "#141414", cap: "#c9a45c", liquid: "#3b2f1c" },
    variants: [{ ml: 90, sku: "LAT-QAFU-90", price: 139, compareAt: 159, stock: 9 }],
  },
  {
    slug: "lattafa-suqraat",
    brand: "Lattafa",
    name: "Suqraat",
    gender: "Unisex",
    family: "Oriental",
    description:
      "Oriental y profundo, con incienso y especias sobre maderas y cuero. Para la noche.",
    notes: { top: ["Incienso", "Cardamomo"], heart: ["Cuero", "Rosa"], base: ["Oud", "Sándalo", "Almizcle"] },
    colors: { glass: "#2b2b2b", cap: "#9a9a9a", liquid: "#4a4a4a" },
    variants: [{ ml: 100, sku: "LAT-SUQR-100", price: 149, compareAt: 169, stock: 3 }],
  },
  {
    slug: "rasasi-hawas-for-him",
    brand: "Rasasi",
    name: "Hawas for Him",
    gender: "Hombre",
    family: "Acuático",
    description:
      "Fresco y acuático, con manzana, bergamota y notas marinas sobre ámbar gris y almizcle. Perfecto para el calor.",
    notes: { top: ["Manzana", "Bergamota", "Canela"], heart: ["Notas marinas", "Ciruela"], base: ["Ámbar gris", "Almizcle", "Pachulí"] },
    featured: true,
    colors: { glass: "#6f63b8", cap: "#2a2a2a", liquid: "#8f84d6" },
    variants: [{ ml: 100, sku: "RAS-HAWA-100", price: 159, compareAt: 189, stock: 7 }],
  },
  {
    slug: "afnan-9pm",
    brand: "Afnan",
    name: "9PM",
    gender: "Hombre",
    family: "Oriental",
    description:
      "Dulce y seductor: manzana y canela, con un corazón de lavanda y un fondo de vainilla y haba tonka.",
    notes: { top: ["Manzana", "Canela", "Bergamota"], heart: ["Lavanda", "Azahar"], base: ["Vainilla", "Haba tonka", "Ámbar"] },
    colors: { glass: "#151515", cap: "#3a3a3a", liquid: "#2c2a3a" },
    variants: [{ ml: 100, sku: "AFN-9PM-100", price: 139, stock: 0 }],
  },
];

export const automationDefaults = [
  {
    type: "recordatorio_pago",
    delay: 120,
    template:
      "Hola {nombre} 👋 Tu pedido *{codigo}* sigue reservado. Cuando hagas el pago por {metodo} envíanos la captura del comprobante por aquí y lo despachamos.",
  },
  {
    type: "ultimo_aviso_pago",
    delay: 22 * 60,
    template:
      "Hola {nombre}, tu reserva del pedido *{codigo}* vence en 2 horas. Si aún lo quieres, envía tu comprobante y lo separamos para ti.",
  },
  {
    type: "pedido_vencido",
    delay: 24 * 60,
    template:
      "Hola {nombre}, tu pedido *{codigo}* venció porque no recibimos el pago y liberamos el stock. Si todavía lo quieres, escríbenos y te ayudamos.",
  },
  {
    type: "comprobante_recibido",
    delay: 0,
    template: "¡Gracias {nombre}! Recibimos tu comprobante del pedido *{codigo}*. Lo estamos validando y te avisamos en breve. 🙌",
  },
  {
    type: "pago_validado",
    delay: 0,
    template:
      "¡Pago confirmado! ✅ Tu pedido *{codigo}* ya está en preparación. Total pagado: {total}. Te avisaremos cuando salga.",
  },
  {
    type: "pago_rechazado",
    delay: 0,
    template:
      "Hola {nombre}, no pudimos validar el comprobante del pedido *{codigo}*. ¿Puedes enviarnos otra captura donde se vea el monto y el número de operación?",
  },
  {
    type: "pedido_despachado",
    delay: 0,
    template: "📦 Tu pedido *{codigo}* va en camino con {agencia}. Número de guía: *{guia}*.",
  },
  {
    type: "pedido_entregado",
    delay: 0,
    template: "¡Tu pedido *{codigo}* fue entregado! Esperamos que disfrutes tu perfume, {nombre}. ✨",
  },
  {
    type: "pedir_resena",
    delay: 3 * 24 * 60,
    template:
      "Hola {nombre}, ¿qué te pareció {perfume}? ⭐ Califícalo en 30 segundos aquí: {link}",
  },
  {
    type: "recompra",
    delay: 60 * 24 * 60,
    template:
      "Hola {nombre} 👋 Hace dos meses llevaste {perfume}. Si se te está acabando, aquí lo tienes de nuevo: {link}",
  },
  {
    type: "cotizacion_lista",
    delay: 0,
    template:
      "Hola {nombre} 👋 Tu cotización *{codigo}* está lista: *{total}*. Válida hasta el {vence}. Revísala y acéptala aquí: {link}",
  },
  {
    type: "stock_repuesto",
    delay: 0,
    template: "¡Buenas noticias, {nombre}! {perfume} volvió a estar disponible: {link}",
  },
];

export async function seed(q: Query) {
  for (const a of automationDefaults) {
    await q(
      "insert into automation_settings (type, delay_minutes, template) values ($1, $2, $3) on conflict (type) do nothing",
      [a.type, a.delay, a.template],
    );
  }

  // Bases creadas antes: si el texto de "pedir reseña" sigue siendo el original, pasa al nuevo (con link para calificar).
  await q("update automation_settings set template = $1 where type = 'pedir_resena' and template = $2", [
    automationDefaults.find((a) => a.type === "pedir_resena")!.template,
    "Hola {nombre}, ¿qué te pareció {perfume}? Nos ayudaría mucho que nos cuentes tu experiencia o nos mandes una foto. 💬",
  ]);

  const [{ n }] = await q<{ n: number }>("select count(*)::int as n from products");
  if (n > 0) return;

  for (const p of seedProducts) {
    const [{ id }] = await q<{ id: number }>(
      `insert into products (slug, brand, name, gender, family, description, notes_top, notes_heart, notes_base, featured, is_new, colors)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [p.slug, p.brand, p.name, p.gender, p.family, p.description, p.notes.top, p.notes.heart, p.notes.base,
       !!p.featured, !!p.isNew, JSON.stringify(p.colors)],
    );
    for (const v of p.variants) {
      await q(
        `insert into product_variants (product_id, ml, sku, price_cents, compare_at_cents, stock) values ($1, $2, $3, $4, $5, $6)`,
        [id, v.ml, v.sku, Math.round(v.price * 100), v.compareAt ? Math.round(v.compareAt * 100) : null, v.stock],
      );
    }
  }
}
