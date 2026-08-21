import { deleteCrmCustomerDocument, getCrmCustomerDocumentFile } from "../../../../../../../admin/crm/crm-customer-documents.server";
import { authorizeCrm, crmJson, protectCrmWrite, requireCrmCapability, requireCrmCustomerAccess } from "../../../../crm-api";

function documentId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageCustomerDocuments");
  if (capabilityError) return capabilityError;

  const { id, documentId: rawId } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  const parsedId = documentId(rawId);
  if (parsedId === null) return crmJson({ ok: false, error: "Document not found." }, 404);
  try {
    const result = await getCrmCustomerDocumentFile(id, parsedId);
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "Firebase document storage is unavailable." }, 503);
    if (result.kind === "missing" || result.kind === "object-missing") return crmJson({ ok: false, error: "Document not found." }, 404);
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
    console.error("Failed to download KCPL customer document", id, rawId, error);
    return crmJson({ ok: false, error: "The document could not be downloaded." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  const auth = await authorizeCrm();
  if ("response" in auth) return auth.response;
  const writeError = protectCrmWrite(request);
  if (writeError) return writeError;
  const capabilityError = requireCrmCapability(auth.permissions, "canManageCustomerDocuments");
  if (capabilityError) return capabilityError;

  const { id, documentId: rawId } = await context.params;
  const accessError = await requireCrmCustomerAccess(id, auth.staff);
  if (accessError) return accessError;
  const parsedId = documentId(rawId);
  if (parsedId === null) return crmJson({ ok: false, error: "Document not found." }, 404);
  try {
    const result = await deleteCrmCustomerDocument(id, parsedId, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return crmJson({ ok: false, error: "Firebase document storage is unavailable." }, 503);
    if (result.kind === "missing") return crmJson({ ok: false, error: "Document not found." }, 404);
    return crmJson({ ok: true });
  } catch (error) {
    console.error("Failed to delete KCPL customer document", id, rawId, error);
    return crmJson({ ok: false, error: "The document could not be deleted." }, 500);
  }
}
