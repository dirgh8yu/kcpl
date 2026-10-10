import { bankLineAsAdvance, ignoreBankLine, matchBankLine } from "../../../../../../admin/finance/bank-statement.server";
import { creditError, financeWriteRequest, json } from "../../../credit-route-auth";

const settlementErrors: Record<string, [string, number]> = {
  already_worked: ["Someone has already dealt with this line.", 409],
  not_money_in: ["Only money in can be matched to an invoice.", 400],
  overpayment: ["That is more than the invoice owes. Tick to keep the extra as the customer's credit.", 409],
  already_paid: ["That invoice is already paid.", 409],
  currency_mismatch: ["The account and the invoice are in different currencies.", 422],
  invalid_status: ["That invoice can't take a payment now.", 409],
  invalid_currency: ["The account's currency isn't one KCPL bills in.", 400],
  invoice_mismatch: ["That invoice isn't this customer's.", 409],
  idempotency_conflict: ["This line was matched differently before.", 409],
  relationship_mismatch: ["That invoice's customer or shipment branch doesn't line up.", 409],
};

/** Match a statement line to an invoice, keep it as an advance, or set it aside. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const field = (key: string) => typeof auth.body[key] === "string" ? auth.body[key] as string : "";
  const action = field("action");
  const lineId = decodeURIComponent(id);
  const result = action === "match"
    ? await matchBankLine(lineId, { invoiceReference: field("invoiceReference"), keepExcessAsCredit: auth.body.keepExcessAsCredit === true }, auth.actor, auth.staff)
    : action === "advance"
      ? await bankLineAsAdvance(lineId, field("customerId"), auth.actor, auth.staff)
      : action === "ignore"
        ? await ignoreBankLine(lineId, field("note"), auth.actor, auth.staff)
        : { kind: "unknown_action" as const };
  if (result.kind === "matched") return json({ ok: true, remaining: result.remaining });
  if (result.kind === "unknown_action") return json({ ok: false, error: "Unknown action." }, 400);
  if (result.kind === "note_required") return json({ ok: false, error: "Say what the line is (bank charge, interest, own transfer)." }, 400);
  if (result.kind === "period_locked" && "period" in result) return json({ ok: false, code: "PERIOD_LOCKED", error: `${result.period} is filed with the tax office and this bank line is dated in it, so it can't be matched now. Ask Management to reopen ${result.period} if the return is being corrected.` }, 409);
  const known = settlementErrors[result.kind];
  if (known) return json({ ok: false, error: known[0] }, known[1]);
  return creditError(result.kind);
}
