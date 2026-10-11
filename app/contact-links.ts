/*
 * The links that put a visitor straight through to KCPL: a tap-to-call, and a
 * WhatsApp chat opened with a first line already written. Pure, so the header,
 * footer and contact page build them the same way.
 */

/** "+977-1-4987510" → "tel:+97714987510". */
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

/** A wa.me link, or null while KCPL has no WhatsApp number: the button is not shown at all rather than shown broken. */
export function whatsappHref(number: string, message: string) {
  const digits = number.replace(/\D/g, "");
  // An international number: country code and subscriber number, as wa.me expects.
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
