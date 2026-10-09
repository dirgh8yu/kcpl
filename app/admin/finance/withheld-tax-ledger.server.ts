import { firebaseAdminDb } from "../../firebase-admin.server";
import { tdsDepositDue, tdsRateOf, withheldTaxInitialStatus, withheldTaxPeriod, type WithheldTaxDirection } from "./withheld-tax-policy";

/*
 * The register of TDS, one document per withholding, written in the same
 * transaction as the invoice or bill row it settles. It is what the TDS
 * report and the certificate and deposit tracking read, so they never scan
 * every invoice's payments.
 */

export const WITHHELD_TAX = "withheld_tax";

type Actor = { name: string; email: string };

export function writeWithheldTax(transaction: FirebaseFirestore.Transaction, input: {
  id: string;
  direction: WithheldTaxDirection;
  documentKind: "invoice" | "payable";
  documentReference: string;
  documentNumber: string;
  ledgerRowId: string;
  counterpartyId: string | null;
  counterpartyName: string;
  counterpartyPan: string | null;
  branch: string;
  currency: string;
  amount: number;
  /** Cash and TDS together: what the withholding was taken from. */
  settledAmount: number;
  withheldOn: string;
  certificateNumber: string;
  actor: Actor;
  now: string;
}) {
  const period = withheldTaxPeriod(input.withheldOn);
  transaction.create(firebaseAdminDb().collection(WITHHELD_TAX).doc(input.id), {
    direction: input.direction,
    status: withheldTaxInitialStatus(input.direction, input.certificateNumber),
    document_kind: input.documentKind,
    document_reference: input.documentReference,
    document_number: input.documentNumber,
    ledger_row_id: input.ledgerRowId,
    counterparty_id: input.counterpartyId,
    counterparty_name: input.counterpartyName,
    counterparty_pan: input.counterpartyPan,
    branch: input.branch,
    currency: input.currency,
    amount: input.amount,
    settled_amount: input.settledAmount,
    rate: tdsRateOf(input.amount, input.settledAmount),
    withheld_on: input.withheldOn,
    fiscal_year: period?.fiscal_year ?? null,
    bs_year: period?.bs_year ?? null,
    bs_month: period?.bs_month ?? null,
    deposit_due: input.direction === "by_kcpl" ? tdsDepositDue(input.withheldOn) : null,
    certificate_number: input.certificateNumber.trim() || null,
    deposit_reference: null,
    deposited_on: null,
    recorded_by_name: input.actor.name,
    recorded_by_email: input.actor.email,
    created_at: input.now,
    updated_at: input.now,
  });
}
