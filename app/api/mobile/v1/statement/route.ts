import { mobileJson, withMobileSession } from "../../../../portal/portal-mobile-api.server";
import { portalStatementPdf } from "../../../../portal/portal-statement.server";

/** The statement of account for the KCPL app: the portal's rules. */
export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const file = await portalStatementPdf(session);
    if (file.kind === "forbidden") return mobileJson({ ok: false, code: "forbidden", error: "This login does not see invoices." }, 403);
    if (file.kind === "unavailable") return mobileJson({ ok: false, code: "unavailable", error: "The statement is not available just now." }, 503);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(file.bytes.length),
        "content-disposition": `attachment; filename="${file.filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
