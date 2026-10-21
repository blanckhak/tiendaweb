import "server-only";
import { z } from "zod";
import { store } from "@/lib/config";
import { soles } from "@/lib/format";
import { query } from "./db";
import { emailEnabled, esc, sendEmail } from "./email";
import { notifyOwner } from "./whatsapp";

/**
 * Libro de Reclamaciones virtual (Código de Protección y Defensa del Consumidor, Perú).
 * Plazo de respuesta: 15 días hábiles. Se cuentan de lunes a viernes; los feriados no se
 * descuentan automáticamente, así que conviene responder antes.
 */
export const RESPONSE_BUSINESS_DAYS = 15;

export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

const t = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);

export const complaintInput = z
  .object({
    fullName: t(3, 120, "Ingresa tu nombre completo"),
    documentType: z.enum(["DNI", "CE", "Pasaporte", "RUC"]),
    documentNumber: t(6, 15, "Número de documento inválido").regex(/^[A-Za-z0-9-]+$/, "Número de documento inválido"),
    address: t(5, 200, "Ingresa tu domicilio"),
    phone: t(6, 20, "Ingresa tu teléfono"),
    email: z.email("Correo inválido").max(120),
    isMinor: z.boolean().default(false),
    guardianName: z.string().trim().max(120).optional(),
    goodType: z.enum(["producto", "servicio"]),
    amount: z.union([z.literal(""), z.coerce.number().min(0).max(1_000_000)]).optional(),
    goodDescription: t(3, 500, "Describe el producto o servicio"),
    orderCode: z.string().trim().max(20).optional(),
    kind: z.enum(["reclamo", "queja"]),
    detail: t(10, 3000, "Cuéntanos el detalle (mínimo 10 caracteres)"),
    request: t(5, 2000, "Indica qué solicitas"),
    accepted: z.literal(true, "Debes confirmar que los datos son correctos"),
  })
  .superRefine((c, ctx) => {
    if (c.isMinor && !c.guardianName) ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Indica el nombre del padre, madre o apoderado" });
  });

export type ComplaintInput = z.input<typeof complaintInput>;

export type Complaint = {
  id: number;
  code: string;
  full_name: string;
  document_type: string;
  document_number: string;
  address: string;
  phone: string;
  email: string;
  is_minor: boolean;
  guardian_name: string | null;
  good_type: "producto" | "servicio";
  amount_cents: number | null;
  good_description: string;
  order_code: string | null;
  kind: "reclamo" | "queja";
  detail: string;
  request: string;
  status: "pendiente" | "respondido";
  response: string | null;
  responded_at: Date | null;
  due_at: Date;
  created_at: Date;
};

const fmt = (d: Date) => new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Lima" });

/** HTML de la hoja (para el correo y la constancia). */
export function complaintHtml(c: Complaint) {
  const row = (k: string, v: string) => `<tr><td style="padding:4px 8px;color:#666;vertical-align:top">${k}</td><td style="padding:4px 8px">${esc(v)}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;max-width:640px">
  <h2 style="margin:0">Libro de Reclamaciones — Hoja N° ${esc(c.code)}</h2>
  <p style="color:#666">Fecha: ${fmt(c.created_at)} · ${esc(store.legal.name)} · RUC ${esc(store.legal.ruc)} · ${esc(store.legal.address)}</p>
  <h3>1. Consumidor</h3><table>${row("Nombre", c.full_name)}${row("Documento", `${c.document_type} ${c.document_number}`)}${row("Domicilio", c.address)}${row("Teléfono", c.phone)}${row("Correo", c.email)}${c.is_minor ? row("Padre/madre/apoderado", c.guardian_name ?? "") : ""}</table>
  <h3>2. Bien contratado</h3><table>${row("Tipo", c.good_type)}${row("Monto reclamado", c.amount_cents !== null ? soles(c.amount_cents / 100) : "—")}${row("Descripción", c.good_description)}${c.order_code ? row("Pedido", c.order_code) : ""}</table>
  <h3>3. Detalle</h3><table>${row("Tipo", c.kind === "reclamo" ? "Reclamo" : "Queja")}${row("Detalle", c.detail)}${row("Pedido del consumidor", c.request)}</table>
  <h3>4. Respuesta del proveedor</h3><p>${c.response ? `${esc(c.response)}<br><small>Respondido el ${fmt(c.responded_at!)}</small>` : `Pendiente. Plazo máximo: ${fmt(c.due_at)} (${RESPONSE_BUSINESS_DAYS} días hábiles).`}</p>
  <p style="font-size:12px;color:#666">La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.</p>
</div>`;
}

export async function createComplaint(raw: ComplaintInput): Promise<{ complaint: Complaint; emailed: boolean }> {
  const c = complaintInput.parse(raw);
  const due = addBusinessDays(new Date(), RESPONSE_BUSINESS_DAYS);
  const [row] = await query<Complaint>(
    `insert into complaints (code, full_name, document_type, document_number, address, phone, email, is_minor, guardian_name,
       good_type, amount_cents, good_description, order_code, kind, detail, request, due_at)
     values (lpad(nextval('complaint_number_seq')::text, 4, '0') || '-' || to_char(now() at time zone 'America/Lima', 'YYYY'),
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     returning *`,
    [c.fullName, c.documentType, c.documentNumber, c.address, c.phone, c.email.toLowerCase(), c.isMinor, c.isMinor ? c.guardianName : null,
     c.goodType, c.amount === "" || c.amount === undefined ? null : Math.round(c.amount * 100), c.goodDescription,
     c.orderCode?.toUpperCase() || null, c.kind, c.detail, c.request, due],
  );
  const emailed = await sendEmail({
    to: row.email,
    subject: `Constancia de tu ${row.kind} N° ${row.code} — ${store.name}`,
    html: complaintHtml(row),
  });
  await notifyOwner(`Nuevo ${row.kind} en el Libro de Reclamaciones (N° ${row.code}). Plazo: ${fmt(row.due_at)}. Revísalo en el panel.`);
  return { complaint: row, emailed };
}

export const listComplaints = () =>
  query<Complaint & { days_left: number }>(
    `select *, ceil(extract(epoch from (due_at - now())) / 86400)::int as days_left
     from complaints order by status = 'respondido', due_at, created_at desc limit 300`,
  );

export async function getComplaint(code: string) {
  const [c] = await query<Complaint>("select * from complaints where code = $1", [code]);
  return c ?? null;
}

/** Registra la respuesta del proveedor y la envía por correo (si el correo está configurado). */
export async function respondComplaint(code: string, response: string) {
  const text = z.string().trim().min(10, "La respuesta es muy corta").max(5000).parse(response);
  const [c] = await query<Complaint>(
    "update complaints set response = $2, responded_at = now(), status = 'respondido' where code = $1 returning *",
    [code, text],
  );
  if (!c) throw new Error("Hoja no encontrada.");
  const emailed = await sendEmail({ to: c.email, subject: `Respuesta a tu ${c.kind} N° ${c.code} — ${store.name}`, html: complaintHtml(c) });
  return { complaint: c, emailed, emailConfigured: emailEnabled() };
}
