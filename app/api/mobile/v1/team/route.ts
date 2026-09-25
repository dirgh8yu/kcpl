import { portalWriteResponse } from "../../../../portal/portal-intake";
import { mobileJson, withMobileSession } from "../../../../portal/portal-mobile-api.server";
import { changePortalTeam, portalTeamView } from "../../../../portal/portal-team.server";

/** The account owner's team, from the KCPL app. The customer is always the
 * session's; the decision is the shared, tested one the web portal uses. */
export async function GET(request: Request) {
  return withMobileSession(request, async (session) => portalWriteResponse(await portalTeamView(session), "private, no-store"));
}

export async function POST(request: Request) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The change could not be read." }, 400);
    }
    return portalWriteResponse(await changePortalTeam(session, body ?? {}), "private, no-store");
  });
}
