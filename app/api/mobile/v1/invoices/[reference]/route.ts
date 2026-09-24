import { getPortalInvoice } from "../../../../../portal/portal-data.server";
import { mobileForbidden, mobileJson, mobileMissing, mobileUnavailable, withMobileSession } from "../../../../../portal/portal-mobile-api.server";

export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    const result = await getPortalInvoice(session, reference);
    if (result.kind === "forbidden") return mobileForbidden();
    if (result.kind === "missing") return mobileMissing("Invoice");
    if (result.kind !== "ready") return mobileUnavailable();
    return mobileJson({ ok: true, invoice: result.invoice });
  });
}
