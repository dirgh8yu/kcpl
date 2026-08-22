import { runTrackingHealthSweep } from "../../../admin/visibility/tracking-visibility.server";
import { recordOrderedTrackingEvent } from "../../../admin/visibility/tracking-ingest.server";
import { trackingSources, type TrackingSource } from "../../../admin/visibility/tracking-visibility";
import { trackingMachineAuthorized } from "../../../machine-auth-policy";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

export const trackingIntegrationAuthorized = trackingMachineAuthorized;

export async function POST(request: Request) {
  const auth = trackingIntegrationAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The tracking payload could not be read." }, 400); }
  const action = clean(body.action, 40) || "event";
  if (action === "sweep") {
    const result = await runTrackingHealthSweep();
    if (result.kind !== "ready") return json({ ok: false, error: "Tracking storage is unavailable." }, 503);
    return json({ ok: true, checked: result.checked, opened: result.opened, generatedAt: result.generated_at });
  }
  const reference = clean(body.reference, 160);
  const rawStatus = clean(body.rawStatus ?? body.status, 300);
  const sourceText = clean(body.source, 40) as TrackingSource;
  const source: TrackingSource = trackingSources.includes(sourceText) && sourceText !== "manual" ? sourceText : "webhook";
  if (!reference || !rawStatus) return json({ ok: false, error: "reference and rawStatus are required." }, 400);
  const provider = clean(body.provider, 180) || "External tracking feed";
  const result = await recordOrderedTrackingEvent(reference, {
    rawStatus,
    milestone: clean(body.milestone, 60) || null,
    title: clean(body.title, 240),
    location: clean(body.location, 300),
    latitude: optionalNumber(body.latitude),
    longitude: optionalNumber(body.longitude),
    eventTime: clean(body.eventTime ?? body.event_time, 80),
    source,
    provider,
    providerEventId: clean(body.providerEventId ?? body.provider_event_id, 240),
    details: clean(body.details, 3000),
    eta: clean(body.eta, 80),
    confidence: optionalNumber(body.confidence),
  }, { name: provider, email: "tracking@kcpl.internal" });
  if (result.kind === "unavailable") return json({ ok: false, error: "Tracking storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (result.kind === "invalid_branch") return json({ ok: false, error: "Shipment has no authoritative KCPL primary branch and cannot be mutated." }, 409);
  if (result.kind === "invalid_coordinates") return json({ ok: false, error: "Tracking coordinates are invalid." }, 400);
  if (result.kind === "invalid_source") return json({ ok: false, error: "Tracking source is invalid." }, 400);
  if (result.kind === "duplicate") return json({ ok: true, duplicate: true, event: result.event, repairedSideEffects: result.repaired_side_effects ?? 0 });
  if (result.kind !== "created") return json({ ok: false, error: "Tracking event could not be recorded." }, 409);
  return json({
    ok: true,
    event: result.event,
    canonicalStatus: result.status,
    promotionDecision: result.promotion.decision,
    promotionReason: result.promotion.reason,
    promotionBlocked: result.promotion.decision === "blocked",
    historical: result.historical,
    openedExceptions: result.opened_exceptions,
  }, 201);
}
