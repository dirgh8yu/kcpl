import { requestRefund } from "../../../../../../admin/finance/customer-credits.server";
import { creditError, financeWriteRequest, json } from "../../../credit-route-auth";

/** Ask for some or all of a customer's credit to be paid back. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = await requestRefund(decodeURIComponent(id), {
    amount: Number(auth.body.amount),
    reason: typeof auth.body.reason === "string" ? auth.body.reason : "",
    payeeDetails: typeof auth.body.payeeDetails === "string" ? auth.body.payeeDetails : "",
  }, auth.actor, auth.staff);
  if (result.kind === "created") return json({ ok: true, refund: result.refundId, status: result.status });
  return creditError(result.kind);
}
