import { portalWriteResponse } from "../../../../../../portal/portal-intake";
import { withMobileSession } from "../../../../../../portal/portal-mobile-api.server";
import { listPortalRemittances, receivePortalRemittance } from "../../../../../../portal/portal-remittance-intake.server";

/** Payment receipts from the KCPL app. A claim for KCPL accounts to match,
 * never a ledger entry, under the web portal's own rules. */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    return portalWriteResponse(await listPortalRemittances(session, reference), "private, no-store");
  });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    return portalWriteResponse(await receivePortalRemittance(session, reference, request), "private, no-store");
  });
}
