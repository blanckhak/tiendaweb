/** Normaliza un teléfono al formato de WhatsApp: solo dígitos y con código de país (Perú por defecto). */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^9\d{8}$/.test(digits)) return `51${digits}`; // celular peruano sin código
  if (/^519\d{8}$/.test(digits)) return digits;
  if (/^\d{10,15}$/.test(digits)) return digits; // otro país, ya con código
  return null;
}

export const displayPhone = (phone: string) =>
  phone.startsWith("51") && phone.length === 11 ? `${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}` : `+${phone}`;
