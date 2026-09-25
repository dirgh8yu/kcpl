/*
 * Sparrow SMS (Nepal). Off until SPARROW_SMS_TOKEN and SPARROW_SMS_FROM (the
 * approved sender identity) are set as secrets; nothing here holds either.
 */

const SPARROW_URL = "https://api.sparrowsms.com/v2/sms/";

export function smsConfigured() {
  return Boolean(process.env.SPARROW_SMS_TOKEN?.trim() && process.env.SPARROW_SMS_FROM?.trim());
}

/** [to] is +977 and ten digits; Sparrow takes the ten. */
export async function sendSms(to: string, text: string) {
  const token = process.env.SPARROW_SMS_TOKEN?.trim();
  const from = process.env.SPARROW_SMS_FROM?.trim();
  if (!token || !from) throw new Error("SMS is not configured.");
  const local = to.replace(/^\+977/, "");
  const response = await fetch(SPARROW_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, from, to: local, text }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Sparrow SMS refused the message (HTTP ${response.status}).`);
}
