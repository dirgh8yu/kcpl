/*
 * WhatsApp Business (Meta's Cloud API). A business may only start a
 * conversation with an approved template, so every notice is the template
 * named by WHATSAPP_TEMPLATE (default "kcpl_update") with two body variables:
 * {{1}} the headline, {{2}} the detail line. Off until WHATSAPP_ACCESS_TOKEN
 * and WHATSAPP_PHONE_NUMBER_ID are set as secrets.
 */

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

export async function sendWhatsappTemplate(to: string, headline: string, detail: string, locale: "en" | "ne") {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) throw new Error("WhatsApp is not configured.");
  const template = process.env.WHATSAPP_TEMPLATE?.trim() || "kcpl_update";
  const clip = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1)}…`);
  const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: locale === "ne" ? "ne" : "en" },
        components: [{
          type: "body",
          parameters: [
            // Template variables may not carry new lines.
            { type: "text", text: clip(headline.replace(/\s+/g, " "), 200) },
            { type: "text", text: clip((detail || headline).replace(/\s+/g, " "), 500) },
          ],
        }],
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`WhatsApp refused the message (HTTP ${response.status}).`);
}
