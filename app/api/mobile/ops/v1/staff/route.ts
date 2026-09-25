import { staffAssignmentOptions } from "../../../../../admin/job-file-requests.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../admin/ops-mobile-api.server";

/** Who a job can be given to, as the web's picker offers. */
export async function GET(request: Request) {
  return withStaffSession(request, async ({ staff }) => {
    const options = await staffAssignmentOptions(staff);
    if (options === null) return opsUnavailable();
    return opsJson({ ok: true, options });
  });
}
