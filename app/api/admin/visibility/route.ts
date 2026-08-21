import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { getShipmentTrackingVisibility, listTrackingVisibility, recordTrackingEvent, runTrackingHealthSweep } from "../../../admin/visibility/tracking-visibility.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

async function auth() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Digital Job File access is required." }, 403) };
  return { user: access.user, staff };
}

export async function GET(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  const url = new URL(request.url);
  const reference = clean(url.searchParams.get("reference"), 160);
  if (reference) {
    const result = await getShipmentTrackingVisibility(reference, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Tracking storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
    if (result.kind !== "ready") return json({ ok: false, error: "Shipment branch data is invalid." }, 409);
    return json({ ok: true, events: result.events });
  }
  const result = await listTrackingVisibility(access.staff);
  if (result.kind !== "ready") return json({ ok: false, error: "Visibility storage is unavailable." }, 503);
  return json({ ok: true, rows: result.rows, summary: result.summary, generatedAt: result.generated_at });
}

export async function POST(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin visibility updates are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = clean(body.action, 40);
  if (action === "sweep") {
    if (access.staff.permissions.role !== "management") return json({ ok: false, error: "Management access is required to run the tracking health sweep." }, 403);
    const result = await runTrackingHealthSweep(access.staff);
    if (result.kind !== "ready") return json({ ok: false, error: "Tracking storage is unavailable." }, 503);
    return json({ ok: true, checked: result.checked, opened: result.opened, generatedAt: result.generated_at });
  }
  if (action === "record") {
    const reference = clean(body.reference, 160);
    const rawStatus = clean(body.rawStatus, 300);
    if (!reference || !rawStatus) return json({ ok: false, error: "Shipment reference and tracking status are required." }, 400);
    const result = await recordTrackingEvent(reference, {
      rawStatus,
      milestone: clean(body.milestone, 60) || null,
      title: clean(body.title, 240),
      location: clean(body.location, 300),
      latitude: optionalNumber(body.latitude),
      longitude: optionalNumber(body.longitude),
      eventTime: clean(body.eventTime, 80),
      source: "manual",
      provider: clean(body.provider, 180) || "KCPL manual update",
      providerEventId: "",
      details: clean(body.details, 3000),
      eta: clean(body.eta, 80),
      confidence: optionalNumber(body.confidence),
    }, { name: access.user.displayName, email: access.user.email }, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Tracking storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
    if (result.kind === "invalid_coordinates") return json({ ok: false, error: "Tracking coordinates are invalid." }, 400);
    if (result.kind !== "created" && result.kind !== "duplicate") return json({ ok: false, error: "Tracking event could not be recorded." }, 400);
    return json({ ok: true, ...result });
  }
  return json({ ok: false, error: "Unknown visibility action." }, 400);
}
