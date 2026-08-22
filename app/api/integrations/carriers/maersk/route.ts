import { ingestMaerskDcsaPayloadSafely } from "../../../../admin/carrier-integrations/maersk-webhook.server";
import { maerskMachineAuthorized } from "../../../../machine-auth-policy";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export const maerskWebhookAuthorized = maerskMachineAuthorized;

export async function POST(request: Request) {
  const auth = maerskWebhookAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return json({ ok: false, error: "The DCSA tracking payload could not be read." }, 400); }
  try {
    const result = await ingestMaerskDcsaPayloadSafely(payload);
    if (result.kind === "unavailable") return json({ ok: false, error: "Carrier integration storage is unavailable." }, 503);
    if (result.kind === "invalid") return json({ ok: false, error: "No valid DCSA Track & Trace events were found." }, 400);
    return json({ ok: true, ...result }, 202);
  } catch (error) {
    console.error("Failed to ingest Maersk DCSA tracking payload", error);
    return json({ ok: false, error: "Maersk tracking events could not be processed." }, 500);
  }
}
