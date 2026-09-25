import { listPortalQuotes } from "../../../../portal/portal-data.server";
import { mobileJson, mobileUnavailable, withMobileSession } from "../../../../portal/portal-mobile-api.server";

/** Priced quotes and requests still with KCPL, from the portal's own reader. */
export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const result = await listPortalQuotes(session);
    if (result.kind !== "ready") return mobileUnavailable();
    return mobileJson({ ok: true, quotes: result.quotes, requests: result.requests });
  });
}
