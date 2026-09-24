import { opsJson, opsSessionView, withStaffSession } from "../../../../../admin/ops-mobile-api.server";

export async function GET(request: Request) {
  return withStaffSession(request, async (session) => opsJson({ ok: true, session: opsSessionView(session) }));
}
