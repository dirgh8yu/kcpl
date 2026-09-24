import { loadCommandCentre } from "../../../../../admin/command-centre/command-centre.server";
import { opsJson, opsSessionView, opsUnavailable, withStaffSession } from "../../../../../admin/ops-mobile-api.server";

/** The command centre, as the web Overview loads it: same branch scoping,
 * same limits, same QA behaviour. */
export async function GET(request: Request) {
  return withStaffSession(request, async (session) => {
    try {
      const data = await loadCommandCentre(session.staff);
      if (!data) return opsUnavailable();
      return opsJson({ ok: true, session: opsSessionView(session), data });
    } catch (error) {
      console.error("KCPL ops mobile command centre failed", error);
      return opsUnavailable();
    }
  });
}
