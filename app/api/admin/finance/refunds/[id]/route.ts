import { vatPeriodLockedMessage } from "../../../../../admin/finance/vat-period-lock";
import { moveRefund } from "../../../../../admin/finance/customer-credits.server";
import type { RefundAction } from "../../../../../admin/finance/refund-policy";
import { creditError, financeWriteRequest, json } from "../../credit-route-auth";

const actions: RefundAction[] = ["approve", "reject", "cancel", "pay"];

/** Approve, reject, cancel or record a refund as paid. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const action = auth.body.action as RefundAction;
  if (!actions.includes(action)) return json({ ok: false, error: "Unknown refund action." }, 400);
  const { id } = await context.params;
  const field = (key: string) => typeof auth.body[key] === "string" ? auth.body[key] as string : "";
  const result = await moveRefund(decodeURIComponent(id), action, {
    note: field("note"), paidOn: field("paidOn"), method: field("method"), paymentReference: field("paymentReference"),
  }, auth.actor, auth.staff);
  if (result.kind === "updated") return json({ ok: true, status: result.status, number: result.number });
  if (result.kind === "period_locked") return json({ ok: false, code: "PERIOD_LOCKED", error: vatPeriodLockedMessage(result.period) }, 409);
  return creditError(result.kind);
}
