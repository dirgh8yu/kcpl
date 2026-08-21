import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../../admin/staff-directory.server";
import { checkShipmentBranchAccess } from "../../../../../../admin/shipment-access.server";
import { isTrustedSameOriginRequest } from "../../../../../../request-security";
import {
  canDeleteShipmentDocument,
  shipmentDocumentTransitionError,
} from "../../../../../../shipment-document-policy";
import { shipmentDocumentReviewStatuses, type ShipmentDocumentReviewStatus } from "../../../../../../shipment-document-types";
import {
  deleteShipmentDocument,
  getShipmentDocumentFile,
  getShipmentDocumentMetadata,
  updateShipmentDocumentControl,
} from "../../../../../../shipment-documents.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") return { user: access.user, staff: await getStaffContext(access.user) };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

async function guard(reference: string, staff: Awaited<ReturnType<typeof getStaffContext>>) {
  const access = await checkShipmentBranchAccess(reference, staff);
  if (access.kind === "unavailable") return json({ ok: false, error: "Shipment storage is unavailable." }, 503);
  if (access.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (access.kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  return null;
}

function documentId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const { reference, id } = await context.params;
  const accessError = await guard(reference, auth.staff);
  if (accessError) return accessError;
  const parsedId = documentId(id);
  if (parsedId === null) return json({ ok: false, error: "Document not found." }, 404);

  try {
    const result = await getShipmentDocumentFile(reference, parsedId);
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase document storage is unavailable." }, 503);
    if (result.kind === "missing" || result.kind === "object-missing") return json({ ok: false, error: "Document not found." }, 404);

    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "content-type": result.document.content_type || "application/octet-stream",
        "content-length": String(result.document.size_bytes),
        "content-disposition": contentDisposition(result.document.filename),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to download KCPL Firebase shipment document", error);
    return json({ ok: false, error: "The document could not be downloaded." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin document reviews are not accepted." }, 403);

  const { reference, id } = await context.params;
  const accessError = await guard(reference, auth.staff);
  if (accessError) return accessError;
  const parsedId = documentId(id);
  if (parsedId === null) return json({ ok: false, error: "Document not found." }, 404);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The document review could not be read." }, 400); }
  const status = clean(body.status, 40);
  const reviewNote = clean(body.reviewNote, 4000);
  const expiresOn = clean(body.expiresOn, 10);
  const customerSafe = body.customerSafe === true;
  if (!shipmentDocumentReviewStatuses.includes(status as ShipmentDocumentReviewStatus)) return json({ ok: false, error: "Choose a valid document review status." }, 400);

  try {
    const metadata = await getShipmentDocumentMetadata(reference, parsedId);
    if (metadata.kind === "unavailable") return json({ ok: false, error: "Firebase document metadata storage is unavailable." }, 503);
    if (metadata.kind === "missing") return json({ ok: false, error: "Document not found." }, 404);
    const error = shipmentDocumentTransitionError({
      from: metadata.document.review_status,
      to: status,
      role: auth.staff.permissions.role,
      actorEmail: auth.user.email,
      uploadedByEmail: metadata.document.uploaded_by_email,
      reviewNote,
      expiresOn,
    });
    if (error) return json({ ok: false, error }, 403);

    const result = await updateShipmentDocumentControl(reference, parsedId, {
      status: status as ShipmentDocumentReviewStatus,
      customerSafe,
      reviewNote,
      expiresOn,
    }, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "missing") return json({ ok: false, error: "Document not found." }, 404);
    return json({ ok: true, document: result.document });
  } catch (error) {
    console.error("Failed to review KCPL Firebase shipment document", error);
    return json({ ok: false, error: "The document review could not be saved." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin deletes are not accepted." }, 403);

  const { reference, id } = await context.params;
  const accessError = await guard(reference, auth.staff);
  if (accessError) return accessError;
  const parsedId = documentId(id);
  if (parsedId === null) return json({ ok: false, error: "Document not found." }, 404);

  try {
    const metadata = await getShipmentDocumentMetadata(reference, parsedId);
    if (metadata.kind === "unavailable") return json({ ok: false, error: "Firebase document metadata storage is unavailable." }, 503);
    if (metadata.kind === "missing") return json({ ok: false, error: "Document not found." }, 404);
    const allowed = canDeleteShipmentDocument({
      role: auth.staff.permissions.role,
      actorEmail: auth.user.email,
      uploadedByEmail: metadata.document.uploaded_by_email,
      status: metadata.document.review_status,
    });
    if (!allowed) return json({ ok: false, error: "Only Management can delete reviewed documents. Operations may delete only their own still-unreviewed upload." }, 403);

    const result = await deleteShipmentDocument(reference, parsedId, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase document storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Document not found." }, 404);
    return json({ ok: true, storageDeleted: result.storageDeleted, warning: result.storageDeleted ? null : "The document is tombstoned and inaccessible, but Storage cleanup is pending." });
  } catch (error) {
    console.error("Failed to delete KCPL Firebase shipment document", error);
    return json({ ok: false, error: "The document could not be deleted." }, 500);
  }
}
