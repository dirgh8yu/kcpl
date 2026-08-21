import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { checkShipmentBranchAccess } from "../../../../../admin/shipment-access.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";
import { validateShipmentDocumentBytes } from "../../../../../shipment-document-policy";
import { shipmentDocumentTypes, type ShipmentDocumentType } from "../../../../../shipment-document-types";
import { listShipmentDocuments, uploadShipmentDocument } from "../../../../../shipment-documents.server";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const allowedExtensions: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};

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

function extension(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function optionalDocumentId(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") return null;
  const text = String(value).trim();
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const { reference } = await context.params;
  const accessError = await guard(reference, auth.staff);
  if (accessError) return accessError;
  try {
    const result = await listShipmentDocuments(reference);
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase document metadata storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    return json({ ok: true, documents: result.documents, storageAvailable: result.storageAvailable });
  } catch (error) {
    console.error("Failed to list KCPL Firebase shipment documents", error);
    return json({ ok: false, error: "Shipment documents could not be loaded." }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!auth.staff.permissions.canManageJobFile) return json({ ok: false, error: "Job File document access is not available for this account." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin uploads are not accepted." }, 403);

  const { reference } = await context.params;
  const accessError = await guard(reference, auth.staff);
  if (accessError) return accessError;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "The upload could not be read." }, 400);
  }

  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "").trim();
  const supersedesDocumentId = optionalDocumentId(form.get("supersedesDocumentId"));
  if (!(file instanceof File)) return json({ ok: false, error: "Choose a document to upload." }, 400);
  if (!shipmentDocumentTypes.includes(documentType as ShipmentDocumentType)) {
    return json({ ok: false, error: "Choose a valid document type." }, 400);
  }
  if (!file.name.trim() || file.name.length > 240) return json({ ok: false, error: "The file name is invalid." }, 400);
  if (file.size <= 0) return json({ ok: false, error: "The selected file is empty." }, 400);
  if (file.size > MAX_FILE_BYTES) return json({ ok: false, error: "Documents must be 15 MB or smaller." }, 413);
  if (Number.isNaN(supersedesDocumentId)) return json({ ok: false, error: "The document being replaced is invalid." }, 400);

  const ext = extension(file.name);
  const inferredType = allowedExtensions[ext];
  if (!inferredType) {
    return json({ ok: false, error: "Use PDF, JPG, PNG, WEBP, Word, Excel, CSV or TXT files." }, 415);
  }

  const data = await file.arrayBuffer();
  const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
  if (signatureError) return json({ ok: false, error: signatureError }, 415);

  try {
    const result = await uploadShipmentDocument(reference, {
      filename: file.name.trim(),
      contentType: inferredType,
      sizeBytes: file.size,
      documentType: documentType as ShipmentDocumentType,
      uploadedBy: auth.user.displayName,
      uploadedByEmail: auth.user.email,
      data,
      supersedesDocumentId,
    });
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase Storage is not configured yet." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    if (result.kind === "duplicate") return json({ ok: false, error: "This exact file is already stored on the shipment.", code: "DUPLICATE_DOCUMENT", document: result.document }, 409);
    if (result.kind === "supersedes_missing") return json({ ok: false, error: "The document being replaced no longer exists." }, 409);
    if (result.kind === "supersedes_type") return json({ ok: false, error: "A replacement document must use the same document type as the version it supersedes." }, 409);
    if (result.kind === "supersedes_inactive") return json({ ok: false, error: "Deleted or already superseded documents cannot be replaced again." }, 409);
    return json({ ok: true, document: result.document }, 201);
  } catch (error) {
    console.error("Failed to upload KCPL Firebase shipment document", error);
    return json({ ok: false, error: "The document could not be stored." }, 500);
  }
}
