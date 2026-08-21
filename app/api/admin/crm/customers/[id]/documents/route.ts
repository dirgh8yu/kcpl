import { crmCustomerDocumentTypes, type CrmCustomerDocumentType } from "../../../../../../admin/crm/crm-customer-document-types";
import { listCrmCustomerDocuments, uploadCrmCustomerDocument } from "../../../../../../admin/crm/crm-customer-documents.server";
import { authorizeCrm, crmJson, protectCrmWrite, requireCrmCapability, requireCrmCustomerAccess } from "../../../crm-api";

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

function extension(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageCustomerDocuments");
  if (capabilityError) return capabilityError;
  const { id } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  try {
    const result = await listCrmCustomerDocuments(id);
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "Firebase document metadata storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, documents: result.documents, storageAvailable: result.storageAvailable });
  } catch (error) {
    console.error("Failed to list KCPL customer documents", id, error);
    return crmJson({ ok: false, error: "Customer documents could not be loaded." }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const writeError = protectCrmWrite(request);
  if (writeError) return writeError;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageCustomerDocuments");
  if (capabilityError) return capabilityError;

  let form: FormData;
  try { form = await request.formData(); } catch { return crmJson({ ok: false, error: "The upload could not be read." }, 400); }
  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "").trim();
  if (!(file instanceof File)) return crmJson({ ok: false, error: "Choose a document to upload." }, 400);
  if (!crmCustomerDocumentTypes.includes(documentType as CrmCustomerDocumentType)) return crmJson({ ok: false, error: "Choose a valid customer document type." }, 400);
  if (!file.name.trim() || file.name.length > 240) return crmJson({ ok: false, error: "The file name is invalid." }, 400);
  if (file.size <= 0) return crmJson({ ok: false, error: "The selected file is empty." }, 400);
  if (file.size > MAX_FILE_BYTES) return crmJson({ ok: false, error: "Documents must be 15 MB or smaller." }, 413);

  const inferredType = allowedExtensions[extension(file.name)];
  if (!inferredType) return crmJson({ ok: false, error: "Use PDF, JPG, PNG, WEBP, Word, Excel, CSV or TXT files." }, 415);

  const { id } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  try {
    const result = await uploadCrmCustomerDocument(id, {
      filename: file.name.trim(),
      contentType: inferredType,
      sizeBytes: file.size,
      documentType: documentType as CrmCustomerDocumentType,
      uploadedBy: auth.user.displayName,
      uploadedByEmail: auth.user.email,
      data: await file.arrayBuffer(),
    });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "Firebase Storage is not configured yet." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Customer record not found." }, 404);
    return crmJson({ ok: true, document: result.document }, 201);
  } catch (error) {
    console.error("Failed to upload KCPL customer document", id, error);
    return crmJson({ ok: false, error: "The customer document could not be stored." }, 500);
  }
}
