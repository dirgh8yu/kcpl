import { parseFreeTimeIngest } from "../../../free-time-ingest";
import { freeTimeMachineAuthorized } from "../../../machine-auth-policy";
import { applyCarrierFreeTime } from "../../../shipment-free-time.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Carrier/terminal free-time feed. Uses its own bearer secret, falling back to the tracking credential. */
export async function POST(request: Request) {
  const auth = freeTimeMachineAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The free-time payload could not be read." }, 400);
  }
  const parsed = parseFreeTimeIngest(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const result = await applyCarrierFreeTime(parsed.value);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (result.kind === "duplicate") return json({ ok: true, duplicate: true });
  if (result.kind === "unavailable") return json({ ok: false, error: "Free-time storage is unavailable." }, 503);
  return json({ ok: true, reference: result.reference }, 201);
}
