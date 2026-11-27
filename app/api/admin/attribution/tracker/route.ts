import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { loadQuoteRecordsForTracker } from "../../../../admin/attribution/attribution.server";
import { trackerCsv } from "../../../quotes/quote-tracker";
import { nepalOperationalDate } from "../../../../invoice-effective-status";

/*
 * The 90-day quote tracker, filled from the same quote records the lead-source
 * page reads. The columns are the tracker's own and the lane columns
 * (`lane_slug`, `lane_origin`, `lane_destination`) arrive filled, so the desk
 * does not need the CLI generator for a routine export.
 *
 * Management only, like the page that links here, and no-store: these rows carry
 * contact details.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return Response.json({ ok: false, error: "Sign in is required." }, { status: 401 });

  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") {
    return Response.json({ ok: false, error: "Management access is required." }, { status: 403 });
  }

  const records = await loadQuoteRecordsForTracker();
  if (!records) return Response.json({ ok: false, error: "Quote records are unavailable." }, { status: 503 });

  const today = nepalOperationalDate();
  return new Response(`\uFEFF${trackerCsv(records)}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kcpl-quote-tracker-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}
