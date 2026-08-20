import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { crmCurrencies } from "../../../admin/crm/crm-data";
import { getNrbForexSnapshot } from "../../../integrations/nrb-forex.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial access is required." }, 403);

  try {
    const snapshot = await getNrbForexSnapshot();
    const supported = new Set(crmCurrencies.filter((currency) => currency !== "NPR"));
    return json({
      ok: true,
      snapshot: {
        ...snapshot,
        rates: snapshot.rates.filter((rate) => supported.has(rate.currency as (typeof crmCurrencies)[number])),
      },
      disclaimer: "NRB reference rates only. Commercial banks and actual settlement rates may differ.",
    });
  } catch (error) {
    console.error("Failed to load NRB Forex rates", error);
    return json({ ok: false, error: "Nepal Rastra Bank reference rates are temporarily unavailable." }, 502);
  }
}
