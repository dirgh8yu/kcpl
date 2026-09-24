import { portalOwnsShipment } from "../../../../../../portal/portal-data.server";
import { portalDocumentReleased } from "../../../../../../portal/portal-access-policy";
import { getShipmentDocumentFile, getShipmentDocumentMetadata } from "../../../../../../shipment-documents.server";
import { recordPortalDocumentDownload } from "../../../../../../portal/portal-access-log.server";
import { mobileJson, mobileMissing, withMobileSession } from "../../../../../../portal/portal-mobile-api.server";

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Document download for the mobile app. It deliberately repeats the portal
 * route (app/api/portal/documents/[reference]/[id]) gate for gate: the shipment
 * belongs to the session's customer, and the document is released to
 * customers. Anything that fails a gate reads as missing. The download is
 * logged to the same access log once the bytes are in hand, so a file taken on
 * a phone counts in a dispute exactly as one taken in a browser.
 */
export async function GET(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference, id } = await context.params;
    const normalized = reference.trim().toUpperCase();
    if (!/^\d+$/.test(id)) return mobileMissing("Document");
    if (!await portalOwnsShipment(session, normalized)) return mobileMissing("Document");

    try {
      const metadata = await getShipmentDocumentMetadata(normalized, Number(id));
      if (metadata.kind === "unavailable") return mobileJson({ ok: false, code: "unavailable", error: "Document storage is unavailable." }, 503);
      if (metadata.kind === "missing") return mobileMissing("Document");
      if (!portalDocumentReleased(metadata.document as unknown as Record<string, unknown>)) return mobileMissing("Document");

      const result = await getShipmentDocumentFile(normalized, Number(id));
      if (result.kind === "unavailable") return mobileJson({ ok: false, code: "unavailable", error: "Document storage is unavailable." }, 503);
      if (result.kind === "missing" || result.kind === "object-missing") return mobileMissing("Document");

      await recordPortalDocumentDownload({
        reference: normalized,
        documentId: Number(id),
        documentType: result.document.document_type,
        filename: result.document.filename,
        sizeBytes: result.document.size_bytes,
        accountEmail: session.email,
        customerId: session.customerId,
      });

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
      console.error("KCPL mobile document download failed", error);
      return mobileJson({ ok: false, code: "error", error: "The document could not be downloaded." }, 500);
    }
  });
}
