// Datos del negocio. Se configuran en .env.local (ver .env.example).
// Las variables NEXT_PUBLIC_* también se usan en el navegador.
const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export const store = {
  name: env(process.env.NEXT_PUBLIC_STORE_NAME, "AURUM"),
  tagline: "Perfumes originales",
  siteUrl: env(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000").replace(/\/$/, ""),
  whatsapp: env(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "51999999999"), // internacional, sin "+"
  pickupAddress: env(process.env.NEXT_PUBLIC_PICKUP_ADDRESS, "Av. Ejemplo 123, Miraflores, Lima"),
  payments: {
    yape: {
      holder: env(process.env.NEXT_PUBLIC_YAPE_HOLDER, "AURUM Perfumes"),
      number: env(process.env.NEXT_PUBLIC_YAPE_NUMBER, "999 999 999"),
    },
    plin: {
      holder: env(process.env.NEXT_PUBLIC_PLIN_HOLDER, "AURUM Perfumes"),
      number: env(process.env.NEXT_PUBLIC_PLIN_NUMBER, "999 999 999"),
    },
  },
  /** Horas que se reserva el stock esperando el comprobante. */
  reservationHours: 24,
  /** Datos legales para el Libro de Reclamaciones. */
  legal: {
    name: env(process.env.NEXT_PUBLIC_BUSINESS_NAME, "AURUM PERFUMES (razón social por definir)"),
    ruc: env(process.env.NEXT_PUBLIC_RUC, "Por definir"),
    address: env(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS, "Por definir"),
  },
  /** Envío gratis a domicilio desde este monto (en soles) en estos departamentos. 0 = desactivado. */
  freeShipping: {
    from: Number(env(process.env.NEXT_PUBLIC_FREE_SHIPPING_FROM, "199")) || 0,
    zones: env(process.env.NEXT_PUBLIC_FREE_SHIPPING_ZONES, "Lima,Callao")
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean),
  },
};

export const departamentos = [
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao",
  "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque",
  "Lima", "Loreto", "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno",
  "San Martín", "Tacna", "Tumbes", "Ucayali",
];
