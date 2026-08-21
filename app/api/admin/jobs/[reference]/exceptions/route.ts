import { getAdminAccess } from "../../../../../admin/admin-auth";
import { kcplBranches, type KcplBranch } from "../../../../../admin/crm/crm-data";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import {
  createShipmentException,
  getShipmentExceptions,
  updateShipmentException,
} from "../../../../../admin/shipment-exceptions.server";
import {
  shipmentExceptionCategories,
  shipmentExceptionSeverities,
  shipmentExceptionStatuses,
  type ShipmentExceptionCategory,
  type ShipmentExceptionSeverity,
  type ShipmentExceptionStatus,
} from "../../../../../admin/shipment-exceptions";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Job File access is required." }, 403) };
  return { user: access.user, staff };
}

function resultError(kind: string) {
  if (kind === "unavailable") return json({ ok: false, error: "Shipment exception storage is unavailable." }, 503);
  if (kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (kind === "forbidden") return json({ ok: false, error: "This shipment or exception is outside your branch access." }, 403);
  if (kind === "invalid_branch") return json({ ok: false, error: "Choose a branch assigned to this shipment and within your staff access." }, 400);
  if (kind === "invalid_category") return json({ ok: false, error: "Choose a valid exception category." }, 400);
  if (kind === "invalid_severity") return json({ ok: false, error: "Choose a valid exception severity." }, 400);
  if (kind === "invalid_status") return json({ ok: false, error: "Choose a valid exception state." }, 400);
  if (kind === "invalid_transition") return json({ ok: false, error: "That exception state change is not allowed." }, 409);
  if (kind === "resolution_required") return json({ ok: false, error: "Record a resolution of at least 12 characters before resolving the exception." }, 400);
  if (kind === "missing_exception") return json({ ok: false, error: "Exception case not found." }, 404);
  if (kind === "invalid_exception") return json({ ok: false, error: "Exception case data is invalid." }, 409);
  return json({ ok: false, error: "The shipment exception action could not be completed." }, 500);
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const result = await getShipmentExceptions(reference, auth.staff);
  if (result.kind !== "ready") return resultError(result.kind);
  return json({ ok: true, exceptions: result.exceptions, summary: result.summary, generated_at: result.generated_at });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin exception updates are not accepted." }, 403);
  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The exception case could not be read." }, 400); }

  const category = clean(body.category, 40) as ShipmentExceptionCategory;
  const severity = clean(body.severity, 20) as ShipmentExceptionSeverity;
  const title = clean(body.title, 240);
  const detail = clean(body.detail, 5000);
  const operationalImpact = clean(body.operationalImpact, 3000);
  const branch = clean(body.branch, 80) as KcplBranch;
  const assignedToName = clean(body.assignedToName, 160);
  const assignedToEmail = clean(body.assignedToEmail, 240).toLowerCase();

  if (!shipmentExceptionCategories.includes(category)) return json({ ok: false, error: "Choose a valid exception category." }, 400);
  if (!shipmentExceptionSeverities.includes(severity)) return json({ ok: false, error: "Choose a valid exception severity." }, 400);
  if (!title || title.length < 5) return json({ ok: false, error: "Add a clear exception title of at least 5 characters." }, 400);
  if (!detail || detail.length < 8) return json({ ok: false, error: "Describe what happened in at least 8 characters." }, 400);
  if (!kcplBranches.includes(branch)) return json({ ok: false, error: "Choose a valid KCPL branch." }, 400);
  if (!validEmail(assignedToEmail)) return json({ ok: false, error: "Enter a valid exception owner email address." }, 400);

  const result = await createShipmentException(reference, {
    category,
    severity,
    title,
    detail,
    operationalImpact,
    branch,
    assignedToName,
    assignedToEmail,
  }, { name: auth.user.displayName, email: auth.user.email }, auth.staff);
  if (result.kind !== "created") return resultError(result.kind);
  return json({ ok: true, exception: result.exception }, 201);
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin exception updates are not accepted." }, 403);
  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The exception update could not be read." }, 400); }

  const exceptionId = clean(body.exceptionId, 180);
  const status = clean(body.status, 30) as ShipmentExceptionStatus;
  const assignedToName = clean(body.assignedToName, 160);
  const assignedToEmail = clean(body.assignedToEmail, 240).toLowerCase();
  const resolution = clean(body.resolution, 5000);
  if (!exceptionId) return json({ ok: false, error: "Exception case not found." }, 404);
  if (!shipmentExceptionStatuses.includes(status)) return json({ ok: false, error: "Choose a valid exception state." }, 400);
  if (!validEmail(assignedToEmail)) return json({ ok: false, error: "Enter a valid exception owner email address." }, 400);

  const result = await updateShipmentException(reference, exceptionId, {
    status,
    assignedToName,
    assignedToEmail,
    resolution,
  }, { name: auth.user.displayName, email: auth.user.email }, auth.staff);
  if (result.kind !== "updated") return resultError(result.kind);
  return json({ ok: true, exception: result.exception });
}
