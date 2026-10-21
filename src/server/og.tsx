import "server-only";
import { ImageResponse } from "next/og";
import { minVariant } from "@/lib/catalog";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { freeShippingEnabled, freeShippingZones, FREE_SHIPPING_FROM } from "@/lib/shipping";
import type { Product } from "@/lib/types";

/** Tamaño estándar de la tarjeta al compartir (WhatsApp, Facebook, X). */
export const OG_SIZE = { width: 1200, height: 630 };

/** Frasco dibujado con cajas (el generador de imágenes solo entiende flexbox). */
function BottleArt({ p, scale = 1 }: { p: Pick<Product, "brand" | "colors">; scale?: number }) {
  const s = (n: number) => n * scale;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: s(80), height: s(70), background: p.colors.cap, borderRadius: s(8) }} />
      <div style={{ width: s(50), height: s(26), background: p.colors.cap, opacity: 0.75 }} />
      <div
        style={{
          width: s(230),
          height: s(300),
          borderRadius: s(28),
          background: `linear-gradient(90deg, ${p.colors.glass}, ${p.colors.liquid} 55%, ${p.colors.glass})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: `${s(14)}px ${s(20)}px`,
            background: "rgba(255,255,255,0.16)",
            color: "white",
            fontSize: s(20),
            letterSpacing: s(4),
          }}
        >
          <span>{p.brand.toUpperCase()}</span>
          <span style={{ fontSize: s(12), letterSpacing: s(1), opacity: 0.8 }}>EAU DE PARFUM</span>
        </div>
      </div>
    </div>
  );
}

const shippingLine = freeShippingEnabled
  ? `Envío gratis en ${freeShippingZones} desde ${soles(FREE_SHIPPING_FROM)}`
  : "Envíos a todo el Perú";

export function productCard(p: Product) {
  const v = minVariant(p);
  const photo = p.image?.startsWith("http") ? p.image : null; // fotos locales (/media) no son accesibles al generar
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#111", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ width: 520, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 40%, #3a3530, #111 70%)" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- dentro de ImageResponse no existe next/image
            <img src={photo} alt="" width={440} height={440} style={{ objectFit: "cover" }} />
          ) : (
            <BottleArt p={p} />
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 64px" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, opacity: 0.6 }}>{p.brand.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 64, lineHeight: 1.05, marginTop: 12 }}>{p.name}</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 28, gap: 18 }}>
            <span style={{ fontSize: 56, fontWeight: 700 }}>{soles(v.price)}</span>
            {v.compareAt && <span style={{ fontSize: 32, opacity: 0.5, textDecoration: "line-through" }}>{soles(v.compareAt)}</span>}
          </div>
          {p.rating && (
            <div style={{ display: "flex", fontSize: 26, color: "#f59e0b", marginTop: 16 }}>
              {"★".repeat(Math.round(p.rating.avg))}
              <span style={{ color: "white", opacity: 0.7, marginLeft: 12 }}>{p.rating.avg.toFixed(1)} ({p.rating.count})</span>
            </div>
          )}
          <div style={{ display: "flex", fontSize: 24, opacity: 0.75, marginTop: 36 }}>{shippingLine} · Compra por WhatsApp</div>
          <div style={{ display: "flex", marginTop: 40 }}>
            <span style={{ border: "2px solid white", padding: "8px 22px", fontSize: 22, letterSpacing: 8 }}>{store.name}</span>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

export function storeCard(hero?: Product) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "radial-gradient(circle at 75% 40%, #3a3530, #111 70%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px" }}>
          <div style={{ display: "flex" }}>
            <span style={{ border: "2px solid white", padding: "10px 26px", fontSize: 26, letterSpacing: 10 }}>{store.name}</span>
          </div>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05, marginTop: 40 }}>Tu estilo. Tu presencia.</div>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.75, marginTop: 24 }}>Perfumes originales · {shippingLine}</div>
          <div style={{ display: "flex", fontSize: 26, color: "#25d366", marginTop: 20 }}>Compra fácil por WhatsApp con Yape o Plin</div>
        </div>
        {hero && (
          <div style={{ width: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BottleArt p={hero} scale={1.15} />
          </div>
        )}
      </div>
    ),
    OG_SIZE,
  );
}
