import { timingSafeEqual } from "node:crypto";
import { ingestMaerskDcsaPayload } from "../../../../admin/carrier-integrations/carrier-integrations.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function authorized(request: Request) {
  const expected = process.env.MAERSK_WEBHOOK_SECRET?.trim() ?? "";
  if (!expected) return { ok: false as const, status: 503, error: "Maersk webhook ingestion is not configured." };
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!supplied) return { ok: false as const, status: 401, error: "Bearer authentication is required." };
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return { ok: false as const, status: 401, error: "Maersk webhook authentication failed." };
  }
  return { ok: true as const };
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return json({ ok: false, error: "The DCSA tracking payload could not be read." }, 400); }
  try {
    const result = await ingestMaerskDcsaPayload(payload);
    if (result.kind === "unavailable") return json({ ok: false, error: "Carrier integration storage is unavailable." }, 503);
    if (result.kind === "invalid") return json({ ok: false, error: "No valid DCSA Track & Trace events were found." }, 400);
    return json({ ok: true, ...result }, 202);
  } catch (error) {
    console.error("Failed to ingest Maersk DCSA tracking payload", error);
    return json({ ok: false, error: "Maersk tracking events could not be processed." }, 500);
  }
}
