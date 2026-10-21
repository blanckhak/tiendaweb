import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { store } from "@/lib/config";
import { query } from "./db";

export const SETTINGS_TAG = "settings";

export type StoreSettings = {
  /** Número que recibe los pedidos del carrito (wa.me), internacional y sin "+". */
  whatsappNumber: string;
  /** Asistente con IA en la tienda web. */
  assistantEnabled: boolean;
};

/** Ajustes del panel con respaldo en .env. Se invalida con updateTag(SETTINGS_TAG) al guardar. */
export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);
  const rows = await query<{ key: string; value: string }>("select key, value from store_settings");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    whatsappNumber: map.get("whatsapp_number") || store.whatsapp,
    assistantEnabled: map.get("assistant_enabled") !== "off",
  };
}

export async function saveStoreSettings(s: StoreSettings) {
  for (const [key, value] of [
    ["whatsapp_number", s.whatsappNumber],
    ["assistant_enabled", s.assistantEnabled ? "on" : "off"],
  ])
    await query(
      `insert into store_settings (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, value],
    );
}
