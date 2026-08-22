import { getAdminAccess } from "../../../admin/admin-auth";
import { listCarrierIntegrationDashboard, searchMaerskOceanSchedules, syncDhlTracking } from "../../../admin/carrier-integrations/carrier-integrations.server";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max = 400) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Carrier integration access is not available for this account." }, 403) };
  return { access, staff };
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  try {
    const result = await listCarrierIntegrationDashboard(auth.staff);
    if (result.kind !== "ready") return json({ ok: false, error: "Carrier integration storage is unavailable." }, 503);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to load carrier integrations", error);
    return json({ ok: false, error: "Carrier integrations could not be loaded." }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin carrier integration actions are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The carrier integration request could not be read." }, 400); }
  const action = clean(body.action, 80);

  if (action === "sync_dhl_tracking") {
    const reference = clean(body.reference, 180).toUpperCase();
    if (!reference) return json({ ok: false, error: "Shipment reference is required." }, 400);
    const result = await syncDhlTracking(reference, { name: auth.access.user.displayName, email: auth.access.user.email }, auth.staff);
    if (result.kind === "not_configured") return json({ ok: false, error: "DHL Express MyDHL credentials are not configured." }, 409);
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
    if (result.kind === "invalid_branch") return json({ ok: false, error: "Shipment branch could not be resolved." }, 409);
    if (result.kind === "tracking_reference_required") return json({ ok: false, error: "Add the DHL waybill/tracking number to carrier reference before syncing." }, 409);
    if (result.kind === "provider_error") return json({ ok: false, error: result.error, providerStatus: "status" in result ? result.status : null }, 502);
    if (result.kind !== "ready") return json({ ok: false, error: "DHL tracking could not be synchronized." }, 409);
    return json({ ok: true, result });
  }

  if (action === "maersk_schedules") {
    if (!auth.staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial access is required for schedule planning." }, 403);
    const origin = clean(body.origin, 12).toUpperCase();
    const destination = clean(body.destination, 12).toUpperCase();
    const result = await searchMaerskOceanSchedules(origin, destination);
    if (result.kind === "not_configured") return json({ ok: false, error: "Maersk Consumer-Key is not configured." }, 409);
    if (result.kind === "invalid_locations") return json({ ok: false, error: "Use five-character UN/LOCODEs such as INCCU or SGSIN." }, 400);
    if (result.kind === "provider_error") return json({ ok: false, error: result.error, providerStatus: "status" in result ? result.status : null }, 502);
    return json({ ok: true, result });
  }

  return json({ ok: false, error: "Choose a valid carrier integration action." }, 400);
}
