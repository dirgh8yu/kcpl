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
  return staffCashError(result.kind);
}
