import { firebaseAdminDb } from "../../firebase-admin.server";
import { taxDocumentNumber, type FinanceCreditEvent, type TaxDocumentKind } from "./finance-data";
import type { CustomerCreditSource } from "./refund-policy";

/*
 * The writes that move money into a customer's credit, made inside the
 * caller's transaction: the credit note, the payment and the refund
 * functions each run their own, and this keeps the documents they create
 * the same shape.
 */

export const CUSTOMER_CREDITS = "customer_credits";
export const CUSTOMER_REFUNDS = "customer_refunds";

type Actor = { name: string; email: string };

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The next number in a fiscal year's series, read inside the transaction
 * that uses it, so numbers are never skipped or given twice. Call `commit`
 * once the document carrying the number is written.
 */
export async function nextTaxDocumentNumber(transaction: FirebaseFirestore.Transaction, kind: TaxDocumentKind, fiscalYear: string) {
  const ref = firebaseAdminDb().collection("tax_document_series").doc(`${kind}-${fiscalYear}`);
  const series = await transaction.get(ref);
  const sequence = Math.max(0, Math.floor(numberValue(series.get("last_sequence")))) + 1;
  return {
    number: taxDocumentNumber(kind, fiscalYear, sequence),
    sequence,
    commit: () => transaction.set(ref, { kind, fiscal_year: fiscalYear, last_sequence: sequence, updated_at: new Date().toISOString() }, { merge: true }),
  };
}

/** One line in a credit's history. Ids are given by the caller so a retried request writes the same line. */
export function writeCreditEvent(
  transaction: FirebaseFirestore.Transaction,
  creditId: string,
  eventId: string,
  event: Omit<FinanceCreditEvent, "id" | "actor_name" | "created_at">,
  actor: Actor,
  now: string,
) {
  const ref = firebaseAdminDb().collection(CUSTOMER_CREDITS).doc(creditId).collection("history").doc(eventId);
  transaction.set(ref, { ...event, actor_name: actor.name, actor_email: actor.email, created_at: now });
}

/** A new credit for a customer, from money received that KCPL no longer earns. */
export function writeNewCustomerCredit(transaction: FirebaseFirestore.Transaction, input: {
  id: string;
  customerId: string;
  customerName: string;
  branch: string;
  currency: string;
  amount: number;
  source: CustomerCreditSource;
  sourceInvoiceReference: string;
  sourceInvoiceNumber: string;
  sourceDocument: string | null;
  note: string | null;
  actor: Actor;
  now: string;
}) {
  const ref = firebaseAdminDb().collection(CUSTOMER_CREDITS).doc(input.id);
  transaction.create(ref, {
    customer_id: input.customerId,
    customer_name: input.customerName,
    branch: input.branch,
    currency: input.currency,
    amount: input.amount,
    available: input.amount,
    reserved: 0,
    refunded: 0,
    applied: 0,
    status: "open",
    source: input.source,
    source_invoice_reference: input.sourceInvoiceReference,
    source_invoice_number: input.sourceInvoiceNumber,
    source_document: input.sourceDocument,
    note: input.note,
    created_by_name: input.actor.name,
    created_by_email: input.actor.email,
    created_at: input.now,
    updated_at: input.now,
  });
  writeCreditEvent(transaction, input.id, "created", {
    kind: "created",
    amount: input.amount,
    detail: input.source === "credit_note"
      ? `From credit note ${input.sourceDocument ?? ""} on ${input.sourceInvoiceNumber}, already paid`.replace("  ", " ")
      : `Paid more than ${input.sourceInvoiceNumber} owed${input.sourceDocument ? ` (${input.sourceDocument})` : ""}`,
    refund_id: null,
    invoice_reference: input.sourceInvoiceReference,
  }, input.actor, input.now);
  return ref;
}

/**
 * The row on the invoice that takes money already received off it and into
 * the customer's credit. Negative, so the invoice's payments still add up
 * to what it records as paid.
 */
export function writeMovedToCredit(transaction: FirebaseFirestore.Transaction, invoiceRef: FirebaseFirestore.DocumentReference, input: {
  id: string;
  invoiceReference: string;
  amount: number;
  currency: string;
  creditId: string;
  date: string;
  note: string;
  actor: Actor;
  now: string;
}) {
  transaction.create(invoiceRef.collection("payments").doc(input.id), {
    kind: "moved_to_credit",
    invoice_reference: input.invoiceReference,
    amount: -input.amount,
    currency: input.currency,
    payment_date: input.date,
    method: "adjustment",
    reference: null,
    notes: input.note,
    customer_credit_id: input.creditId,
    recorded_by_name: input.actor.name,
    recorded_by_email: input.actor.email,
    created_at: input.now,
  });
}
