import { getAdminAccess } from "../../../../admin/admin-auth";
import {
  getShipmentDocumentChecklist,
  setShipmentDocumentRequirement,
} from "../../../../admin/documents/document-checklist.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function failure(kind: string) {
  switch (kind) {
    case "unavailable": return json({ ok: false, error: "Firebase is not available for this deployment." }, 503);
    case "missing": return json({ ok: false, error: "The shipment could not be found." }, 404);
    case "forbidden": return json({ ok: false, error: "You do not have permission to manage this shipment checklist." }, 403);
    case "invalid_category": return json({ ok: false, error: "Choose a valid KCPL document category." }, 400);
    default: return json({ ok: false, error: "The document checklist could not be updated." }, 500);
  }
}

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  const shipment = new URL(request.url).searchParams.get("shipment")?.trim() || "";
  if (!shipment) return json({ ok: false, error: "A shipment reference is required." }, 400);
  const staff = await getStaffContext(access.user);
  const result = await getShipmentDocumentChecklist(shipment, staff);
  if (result.kind !== "ready") return failure(result.kind);
  return json({ ok: true, checklist: result.checklist });
}

export async function PUT(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin checklist changes are not accepted." }, 403);

  let body: { shipment?: unknown; category?: unknown; required?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ ok: false, error: "The checklist request could not be read." }, 400);
  }
  const shipment = typeof body.shipment === "string" ? body.shipment.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (!shipment || !category || typeof body.required !== "boolean") {
    return json({ ok: false, error: "Shipment, category and required status are required." }, 400);
  }

  const staff = await getStaffContext(access.user);
  const result = await setShipmentDocumentRequirement(shipment, category, body.required, {
    name: access.user.displayName,
    email: access.user.email,
  }, staff);
  if (result.kind !== "ready") return failure(result.kind);
  return json({ ok: true, checklist: result.checklist });
}
