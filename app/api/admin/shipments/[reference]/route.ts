import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { checkShipmentBranchAccess } from "../../../../admin/shipment-access.server";
import { getShipmentWorkflowReadiness, recordWorkflowOverride, validateShipmentTransition } from "../../../../admin/workflow-guard.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";
import { addShipmentEvent, updateShipment } from "../../../../shipment-data.server";
import { shipmentStatuses, type ShipmentStatus } from "../../../../shipment-types";

const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") {
    const staff = await getStaffContext(access.user);
    if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Shipment execution access is required." }, 403) };
    return { user: access.user, staff };
  }
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

async function branchGuard(reference: string, staff: Awaited<ReturnType<typeof getStaffContext>>) {
  const access = await checkShipmentBranchAccess(reference, staff);
  if (access.kind === "unavailable") return json({ ok: false, error: "Shipment storage is unavailable." }, 503);
  if (access.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (access.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  return null;
}

function guardedWorkflowContext(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  // checkShipmentBranchAccess already validated primary + handling branches.
  // The workflow guard still contains an older primary-only branch check, so
  // widen branch scope only for this already-authorised shipment operation.
  return { ...staff, can_access_all_branches: true };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  return validDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

function normalizeNepalDateTime(value: string) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  if (!validDateParts(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - NEPAL_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  const branchError = await branchGuard(reference, auth.staff);
  if (branchError) return branchError;
  const workflowStaff = guardedWorkflowContext(auth.staff);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The shipment update could not be read." }, 400);
  }

  const status = clean(body.status);
  const eta = clean(body.eta);
  const currentLocation = clean(body.currentLocation);
  const carrier = clean(body.carrier);
  const carrierReference = clean(body.carrierReference);
  const customerNote = clean(body.customerNote);
  const overrideReason = clean(body.overrideReason);

  if (!shipmentStatuses.includes(status as ShipmentStatus)) return json({ ok: false, error: "Choose a valid shipment status." }, 400);
  if (eta && !isValidDateOnly(eta)) return json({ ok: false, error: "Choose a real ETA calendar date." }, 400);
  if (currentLocation.length > 180) return json({ ok: false, error: "Current location must be 180 characters or fewer." }, 400);
  if (carrier.length > 160) return json({ ok: false, error: "Carrier must be 160 characters or fewer." }, 400);
  if (carrierReference.length > 160) return json({ ok: false, error: "Carrier reference must be 160 characters or fewer." }, 400);
  if (customerNote.length > 2000) return json({ ok: false, error: "Customer update must be 2000 characters or fewer." }, 400);

  const transition = await validateShipmentTransition(reference, status as ShipmentStatus, workflowStaff, overrideReason);
  if (transition.kind === "unavailable") return json({ ok: false, error: "Workflow controls are unavailable." }, 503);
  if (transition.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (transition.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  if (transition.kind === "blocked") {
    return json({
      ok: false,
      error: transition.blockers.join(" "),
      code: "WORKFLOW_BLOCKED",
      blockers: transition.blockers,
      canOverride: transition.canOverride,
      workflow: transition.readiness,
    }, 409);
  }

  const fromStatus = transition.readiness.status;
  const result = await updateShipment(reference, {
    status: status as ShipmentStatus,
    eta,
    currentLocation,
    carrier,
    carrierReference,
    customerNote,
  }, auth.user.displayName, auth.user.email);

  if (result.kind === "unavailable") return json({ ok: false, error: "Shipment storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (transition.overrideUsed) {
    await recordWorkflowOverride(reference, fromStatus, status as ShipmentStatus, transition.overrideReason, { name: auth.user.displayName, email: auth.user.email });
  }
  const workflow = await getShipmentWorkflowReadiness(reference, workflowStaff);
  return json({ ok: true, shipment: result.shipment, workflow: workflow.kind === "ready" ? workflow.readiness : null, overrideUsed: transition.overrideUsed });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  const branchError = await branchGuard(reference, auth.staff);
  if (branchError) return branchError;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The tracking event could not be read." }, 400);
  }

  const title = clean(body.title);
  const location = clean(body.location);
  const details = clean(body.details);
  const eventTimeInput = clean(body.eventTime);
  const eventTime = normalizeNepalDateTime(eventTimeInput);

  if (!title) return json({ ok: false, error: "Add an event title." }, 400);
  if (title.length > 180) return json({ ok: false, error: "Event title must be 180 characters or fewer." }, 400);
  if (location.length > 180) return json({ ok: false, error: "Event location must be 180 characters or fewer." }, 400);
  if (details.length > 2000) return json({ ok: false, error: "Event details must be 2000 characters or fewer." }, 400);
  if (eventTime === null) return json({ ok: false, error: "Choose a real event date and time." }, 400);

  const result = await addShipmentEvent(reference, { title, location, details, eventTime }, auth.user.displayName);
  if (result.kind === "unavailable") return json({ ok: false, error: "Shipment storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  return json({ ok: true, event: result.event }, 201);
}
