import { createTrackerEndpoint } from "./tracker-endpoint.ts";

/*
 * The 90-day quote tracker, filled from the same quote records the lead-source
 * page reads. The columns are the tracker's own and the lane columns
 * (`lane_slug`, `lane_origin`, `lane_destination`) arrive filled, so the desk
 * does not need the CLI generator for a routine export.
 *
 * Management only, like the page that links here, and no-store: these rows carry
 * contact details. The session, role and record read are imported inside the
 * callbacks so the handler itself stays drivable by `tests/tracker-endpoint.test.mjs`.
 */

export const dynamic = "force-dynamic";

export const GET = createTrackerEndpoint({
  async access() {
    const { getAdminAccess } = await import("../../../../admin/admin-auth");
    return getAdminAccess();
  },
  async roleFor(user) {
    const { getStaffContext } = await import("../../../../admin/staff-directory.server");
    const staff = await getStaffContext(user as Parameters<typeof getStaffContext>[0]);
    return staff.permissions.role;
  },
  async records() {
    const { loadQuoteRecordsForTracker } = await import("../../../../admin/attribution/attribution.server");
    return loadQuoteRecordsForTracker();
  },
});
