import { vatPeriodLockedMessage } from "../../../../admin/finance/vat-period-lock";
import { recordAdvance } from "../../../../admin/finance/customer-credits.server";
import { creditError, financeWriteRequest, json } from "../credit-route-auth";

const advanceErrors: Record<string, [string, number]> = {
  invalid_currency: ["Choose the currency the advance was paid in.", 400],
  invoice_mismatch: ["That invoice isn't this customer's.", 409],
  invoice_not_draft: ["An advance is taken against a draft (proforma) invoice. This one is already issued: record a payment on it instead.", 409],
};

/** Money a customer paid before being invoiced, held as their credit under a numbered receipt. */
export async function POST(request: Request) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const field = (key: string) => typeof auth.body[key] === "string" ? auth.body[key] as string : "";
  const result = await recordAdvance({
    customerId: field("customerId"), currency: field("currency"), amount: Number(auth.body.amount), receivedOn: field("receivedOn"),
    method: field("method"), reference: field("reference"), notes: field("notes"), forInvoiceReference: field("forInvoiceReference"),
    idempotencyKey: request.headers.get("idempotency-key")?.trim() || field("idempotencyKey"),
  }, auth.actor, auth.staff);
  if (result.kind === "created" || result.kind === "idempotent") return json({ ok: true, credit: result.creditId, receipt: result.receiptNumber, idempotent: result.kind === "idempotent" });
  if (result.kind === "period_locked") return json({ ok: false, code: "PERIOD_LOCKED", error: vatPeriodLockedMessage(result.period) }, 409);
  const known = advanceErrors[result.kind];
  if (known) return json({ ok: false, error: known[0] }, known[1]);
  if (result.kind === "missing") return json({ ok: false, error: "No customer with that reference." }, 404);
  return creditError(result.kind);
}
