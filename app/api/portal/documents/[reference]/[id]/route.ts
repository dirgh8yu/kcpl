import { getPortalAccess } from "../../../../../portal/portal-auth";
import { portalOwnsShipment } from "../../../../../portal/portal-data.server";
import { portalDocumentReleased } from "../../../../../portal/portal-access-policy";
import { getShipmentDocumentFile, getShipmentDocumentMetadata } from "../../../../../shipment-documents.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Customer document download.
 *
 * Three gates, in this order, before a single byte is read from Storage:
 * the caller holds a portal session, the shipment belongs to that session's
 * customer, and the document has been explicitly released to customers. A
 * document that fails any gate is reported as missing, never as forbidden.
 */
export async function GET(_request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);

  const { reference, id } = await context.params;
  const normalized = reference.trim().toUpperCase();
  if (!/^\d+$/.test(id)) return json({ ok: false, error: "Document not found." }, 404);
  if (!await portalOwnsShipment(access.session, normalized)) return json({ ok: false, error: "Document not found." }, 404);

  try {
    const metadata = await getShipmentDocumentMetadata(normalized, Number(id));
    if (metadata.kind === "unavailable") return json({ ok: false, error: "Document storage is unavailable." }, 503);
    if (metadata.kind === "missing") return json({ ok: false, error: "Document not found." }, 404);
    if (!portalDocumentReleased(metadata.document as unknown as Record<string, unknown>)) {
      return json({ ok: false, error: "Document not found." }, 404);
    }

    const result = await getShipmentDocumentFile(normalized, Number(id));
    if (result.kind === "unavailable") return json({ ok: false, error: "Document storage is unavailable." }, 503);
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
    console.error("KCPL portal document download failed", error);
    return json({ ok: false, error: "The document could not be downloaded." }, 500);
  }
}
