import { applyCustomerCredit } from "../../../../../../admin/finance/customer-credits.server";
import { creditError, financeWriteRequest, json } from "../../../credit-route-auth";

/** Use a customer's credit to pay another of their invoices. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const result = await applyCustomerCredit(decodeURIComponent(id), {
    invoiceReference: typeof auth.body.invoiceReference === "string" ? auth.body.invoiceReference : "",
    amount: Number(auth.body.amount),
  }, auth.actor, auth.staff);
  if (result.kind === "applied") return json({ ok: true, invoice: result.invoiceNumber, remaining: result.remaining });
  return creditError(result.kind);
}
