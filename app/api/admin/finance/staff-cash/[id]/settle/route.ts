import { vatPeriodLockedMessage } from "../../../../../../admin/finance/vat-period-lock";
import { settleStaffAdvance } from "../../../../../../admin/finance/staff-cash.server";
import { financeWriteRequest, json } from "../../../credit-route-auth";
import { staffCashError } from "../../staff-cash-errors";

/** Settle an advance: the rest comes back, or the staff member is paid what they spent beyond it. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const field = (key: string) => typeof auth.body[key] === "string" ? auth.body[key] as string : "";
  const result = await settleStaffAdvance(decodeURIComponent(id), { settledOn: field("settledOn"), method: field("method") || "cash", note: field("note") }, auth.actor, auth.staff);
  if (result.kind === "settled") return json({ ok: true, settlement: result.settlement, costs: result.costs });
  if (result.kind === "period_locked") return json({ ok: false, code: "PERIOD_LOCKED", error: vatPeriodLockedMessage(result.period) }, 409);
  return staffCashError(result.kind);
}
