import { deliveriesForToday } from "../../../../../admin/delivery/driver-deliveries.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../admin/ops-mobile-api.server";

/** Today's deliveries in the caller's branches, for driver mode. Read only:
 * each delivery is recorded through the job's own delivery route. */
export async function GET(request: Request) {
  return withStaffSession(request, async ({ user, staff }) => {
    const result = await deliveriesForToday(staff, { name: user.displayName, email: user.email });
    if (!result) return opsUnavailable();
    return opsJson({ ok: true, ...result });
  });
}
