export type Gender = "Hombre" | "Mujer" | "Unisex";

export type Variant = {
  id: number;
  ml: number;
  sku: string;
  price: number;
  compareAt?: number;
  /** Unidades disponibles para vender (stock físico menos reservas). */
  stock: number;
};

export type Product = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  gender: Gender;
  family: string;
  description: string;
  notes: { top: string[]; heart: string[]; base: string[] };
  featured?: boolean;
  isNew?: boolean;
  /** Colores del frasco ilustrado, usados mientras no hay foto. */
  colors: { glass: string; cap: string; liquid: string };
  /** URL pública de la foto, si se subió una. */
  image?: string;
  /** Promedio de reseñas aprobadas. */
  rating?: { avg: number; count: number };
  variants: Variant[];
};

/** Forma de los datos iniciales, antes de tener ids en la base de datos. */
export type SeedProduct = Omit<Product, "id" | "variants" | "image" | "rating"> & { variants: Omit<Variant, "id">[] };

export type CartItem = { slug: string; ml: number; qty: number };

export type DeliveryMethod = "domicilio" | "tienda";
export type PaymentMethod = "yape" | "plin";

export type OrderStatus =
  | "pendiente_pago"
  | "pago_en_revision"
  | "pagado"
  | "preparando"
  | "despachado"
  | "entregado"
  | "cancelado"
  | "vencido";
