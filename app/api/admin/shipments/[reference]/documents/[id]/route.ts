import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { isTrustedSameOriginRequest } from "../../../../../../request-security";
import { deleteShipmentDocument, getShipmentDocumentFile } from "../../../../../../shipment-documents.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") return { user: access.user };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

function documentId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const { reference, id } = await context.params;
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

export async function DELETE(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin deletes are not accepted." }, 403);

  const { reference, id } = await context.params;
  const parsedId = documentId(id);
  if (parsedId === null) return json({ ok: false, error: "Document not found." }, 404);

  try {
    const result = await deleteShipmentDocument(reference, parsedId);
    if (result.kind === "unavailable") return json({ ok: false, error: "Firebase document storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Document not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("Failed to delete KCPL Firebase shipment document", error);
    return json({ ok: false, error: "The document could not be deleted." }, 500);
  }
}
