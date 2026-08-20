import { getAdminAccess } from "../../../admin/admin-auth";
import {
  listVaultDocuments,
  uploadVaultDocument,
} from "../../../admin/documents/document-vault.server";
import { DOCUMENT_MAX_BYTES } from "../../../admin/documents/document-vault";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function failure(kind: string) {
  switch (kind) {
    case "unavailable": return json({ ok: false, error: "Firebase is not available for this deployment." }, 503);
    case "storage_unconfigured": return json({ ok: false, needs_configuration: true, error: "Firebase Storage is not configured yet. Enable Storage for the KCPL Firebase project, then roll out App Hosting again." }, 503);
    case "invalid_size": return json({ ok: false, error: "Documents must be larger than 0 bytes and no more than 20 MB." }, 413);
    case "invalid_type": return json({ ok: false, error: "This file type is not allowed. Use PDF, image, Word, Excel or CSV documents." }, 415);
    case "missing": return json({ ok: false, error: "The linked shipment could not be found." }, 404);
    case "missing_customer": return json({ ok: false, error: "The linked customer could not be found." }, 404);
    case "forbidden": return json({ ok: false, error: "You do not have permission to add this document or access this branch." }, 403);
    case "storage_error": return json({ ok: false, error: "The document could not be stored in Firebase Storage." }, 502);
    case "metadata_error": return json({ ok: false, error: "The file uploaded but KCPL could not save its document record. The upload was rolled back." }, 500);
    default: return json({ ok: false, error: "The document could not be uploaded." }, 500);
  }
}

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  const staff = await getStaffContext(access.user);
  const url = new URL(request.url);
  const result = await listVaultDocuments(staff, {
    search: url.searchParams.get("q") || "",
    shipment: url.searchParams.get("shipment") || "",
    customer: url.searchParams.get("customer") || "",
    category: url.searchParams.get("category") || "",
  });
  if (result.kind !== "ready") return failure(result.kind);
  return json({ ok: true, documents: result.documents });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin document uploads are not accepted." }, 403);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > DOCUMENT_MAX_BYTES + 1024 * 1024) {
    return failure("invalid_size");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "The upload form could not be read." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "Choose a document to upload." }, 400);
  if (!file.size || file.size > DOCUMENT_MAX_BYTES) return failure("invalid_size");

  const staff = await getStaffContext(access.user);
  const result = await uploadVaultDocument({
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    bytes: new Uint8Array(await file.arrayBuffer()),
    category: text(form.get("category")),
    shipmentReference: text(form.get("shipment_reference")),
    customerId: text(form.get("customer_id")),
    branch: text(form.get("branch")),
    notes: text(form.get("notes")),
  }, {
    name: access.user.displayName,
    email: access.user.email,
  }, staff);

  if (result.kind !== "created") return failure(result.kind);
  return json({ ok: true, document: result.document }, 201);
}
