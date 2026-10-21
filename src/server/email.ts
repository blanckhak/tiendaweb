import "server-only";

/**
 * Correos transaccionales con Resend (https://resend.com, plan gratuito).
 * Requiere RESEND_API_KEY y EMAIL_FROM (un remitente de tu dominio verificado en Resend).
 * Sin configurar devuelve false y quien llama decide qué mostrar.
 */
export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(msg: { to: string; subject: string; html: string; replyTo?: string }): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, html: msg.html, reply_to: msg.replyTo }),
    });
    if (!res.ok) console.error("[email]", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[email]", e);
    return false;
  }
}

/** Escapa texto del usuario antes de ponerlo en el HTML del correo. */
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
