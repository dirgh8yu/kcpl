import { listPortalInvoices } from "../../../../portal/portal-data.server";
import { mobileForbidden, mobileJson, mobileUnavailable, withMobileSession } from "../../../../portal/portal-mobile-api.server";

export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const result = await listPortalInvoices(session);
    if (result.kind === "forbidden") return mobileForbidden();
    if (result.kind !== "ready") return mobileUnavailable();
    return mobileJson({ ok: true, invoices: result.invoices, summary: result.summary });
  });
}
