import { mobileJson, mobileSessionView, withMobileSession } from "../../../../portal/portal-mobile-api.server";

/** Who the app is signed in as, and which customers it may switch between. */
export async function GET(request: Request) {
  return withMobileSession(request, async (session) => mobileJson({ ok: true, session: mobileSessionView(session) }));
}
