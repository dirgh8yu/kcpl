import { receivePortalDocument } from "../../../../../../portal/portal-document-intake.server";
import { portalWriteResponse } from "../../../../../../portal/portal-intake";
import { withMobileSession } from "../../../../../../portal/portal-mobile-api.server";

/** A document sent from the KCPL app, most often a photo of the paperwork.
 * Every rule is `receivePortalDocument`'s, the web portal's own: capability,
 * ownership, rate limit, the customer-uploadable types, sniffed bytes, and
 * the file lands unreviewed and unreleased. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    return portalWriteResponse(await receivePortalDocument(session, reference, request), "private, no-store");
  });
}
