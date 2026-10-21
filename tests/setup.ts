import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";

// Cada corrida trabaja en una carpeta temporal: los archivos subidos no ensucian el proyecto.
const root = path.resolve(__dirname, "..");
const dir = mkdtempSync(path.join(tmpdir(), "aurum-test-"));
mkdirSync(path.join(dir, "db"));
copyFileSync(path.join(root, "db", "schema.sql"), path.join(dir, "db", "schema.sql"));
process.chdir(dir);

// Sin credenciales: WhatsApp en modo simulado y bot sin IA.
for (const k of ["DATABASE_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "SUPABASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OWNER_WHATSAPP"])
  delete process.env[k];

// La caché de Next no existe fuera del servidor de Next.
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, updateTag: () => {}, revalidateTag: () => {}, refresh: () => {} }));
