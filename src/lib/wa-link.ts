/**
 * Enlace "click to chat" de WhatsApp: https://wa.me/<número>?text=<mensaje codificado>.
 * El número va en formato internacional, solo dígitos y sin "+" (ej. 51987654321).
 */
export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
