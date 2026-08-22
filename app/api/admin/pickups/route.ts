import { getAdminAccess } from "../../../admin/admin-auth";
import { cancelPickup, completePickup, confirmPickup, listPickupWorkspace, missPickup, schedulePickup, assignPickupDriver } from "../../../admin/pickups/pickup-appointments.server";
import { pickupChannels, type PickupChannel } from "../../../admin/pickups/pickup-appointments";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 2000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function bool(value: unknown) { return value === true; }

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Pickup Scheduling requires Digital Job File access." }, 403) };
  return { user: access.user, staff };
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const result = await listPickupWorkspace(auth.staff);
  if (result.kind === "ready") return json({ ok: true, rows: result.rows, summary: result.summary, generated_at: result.generated_at });
  return json({ ok: false, error: "Pickup Scheduling storage is unavailable." }, 503);
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin pickup updates are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The pickup action could not be read." }, 400); }

  const reference = clean(body.reference, 180).toUpperCase();
  const action = clean(body.action, 40);
  if (!reference) return json({ ok: false, error: "Shipment reference is required." }, 400);
  const actor = { name: auth.user.displayName, email: auth.user.email };
  let result;

  if (action === "schedule") {
    const channel = clean(body.channel, 40) as PickupChannel;
    if (!pickupChannels.includes(channel)) return json({ ok: false, error: "Choose a valid pickup request channel." }, 400);
    result = await schedulePickup(reference, {
      windowStart: clean(body.windowStart, 80),
      windowEnd: clean(body.windowEnd, 80),
      pickupLocation: clean(body.pickupLocation, 500),
      contactName: clean(body.contactName, 180),
      contactPhone: clean(body.contactPhone, 100),
      channel,
      confirmed: bool(body.confirmed),
      providerReference: clean(body.providerReference, 180),
      notes: clean(body.notes, 2000),
    }, actor, auth.staff);
  } else if (action === "confirm") {
    result = await confirmPickup(reference, {
      windowStart: clean(body.windowStart, 80),
      windowEnd: clean(body.windowEnd, 80),
      providerReference: clean(body.providerReference, 180),
      notes: clean(body.notes, 2000),
    }, actor, auth.staff);
  } else if (action === "assign_driver") {
    result = await assignPickupDriver(reference, {
      driverName: clean(body.driverName, 180),
      driverPhone: clean(body.driverPhone, 100),
      vehicleReference: clean(body.vehicleReference, 180),
      notes: clean(body.notes, 2000),
    }, actor, auth.staff);
  } else if (action === "picked_up") {
    result = await completePickup(reference, clean(body.eventTime, 80) || null, clean(body.location, 500), actor, auth.staff);
  } else if (action === "missed") {
    result = await missPickup(reference, clean(body.reason, 2000), actor, auth.staff);
  } else if (action === "cancel") {
    result = await cancelPickup(reference, clean(body.note, 2000), actor, auth.staff);
  } else {
    return json({ ok: false, error: "Choose a valid pickup action." }, 400);
  }

  if (result.kind === "updated") return json({ ok: true, appointment: "appointment" in result ? result.appointment : undefined });
  if (result.kind === "missing" || result.kind === "missing_appointment") return json({ ok: false, error: result.kind === "missing" ? "Shipment not found." : "Schedule a pickup appointment first." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your access." }, 403);
  if (result.kind === "invalid_window") return json({ ok: false, error: "Enter a valid pickup window with an end time after the start time." }, 400);
  if (result.kind === "invalid_channel") return json({ ok: false, error: "Choose a valid pickup channel." }, 400);
  if (result.kind === "driver_required") return json({ ok: false, error: "Driver name is required." }, 400);
  if (result.kind === "reason_required") return json({ ok: false, error: "Record why the pickup was missed." }, 400);
  if (result.kind === "already_picked_up") return json({ ok: false, error: "This shipment has already been picked up." }, 409);
  if (result.kind === "cancelled") return json({ ok: false, error: "This pickup appointment was cancelled." }, 409);
  if (result.kind === "invalid_transition") return json({ ok: false, error: "That pickup action is not valid for the current appointment state." }, 409);
  return json({ ok: false, error: "Pickup Scheduling storage is unavailable." }, 503);
}
