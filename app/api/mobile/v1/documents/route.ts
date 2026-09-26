import { listPortalDocuments } from "../../../../portal/portal-data.server";
import { documentPageOffset } from "../../../../portal/portal-document-pagination";
import { mobileJson, mobileUnavailable, withMobileSession } from "../../../../portal/portal-mobile-api.server";

export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const offset = documentPageOffset(new URL(request.url).searchParams.get("offset"));
    if (offset === null) return mobileJson({ ok: false, code: "invalid", error: "Invalid document page." }, 400);
    const result = await listPortalDocuments(session, offset);
    if (result.kind !== "ready") return mobileUnavailable();
    return mobileJson({ ok: true, documents: result.documents, scanned: result.scanned, total: result.total });
  });
}
