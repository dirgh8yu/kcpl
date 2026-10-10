import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import { crmCurrencies } from "../crm/crm-data";
import { financePaymentMethods, type FinancePaymentMethod } from "../finance/finance-data";
import { recomputeCustomerFinance } from "../finance/finance.server";
import { writeMovedToCredit, writeNewCustomerCredit } from "../finance/customer-credit-ledger.server";
import { settlementWithTds } from "../finance/withheld-tax-policy";
import { writeWithheldTax } from "../finance/withheld-tax-ledger.server";
import { lockedVatPeriod } from "../finance/vat-period-lock.server";
import type { KcplStaffContext } from "../staff-directory.server";
import {
  applySettlementPayment,
  normalizeSettlementCurrency,
  paymentDocumentId,
  resolveSettlementBasis,
  settlementCurrenciesMatch,
  settlementRequestFingerprint,
} from "./settlement-policy";

type Actor = { name: string; email: string };
type PaymentInput = {
  amount: number;
  paymentDate: string;
  method: FinancePaymentMethod;
  reference: string;
  notes: string;
  currency?: string | null;
  idempotencyKey?: string | null;
  /** Accounts chose to keep anything above what is owed as the customer's credit. Without it, more than is owed is refused. */
  keepExcessAsCredit?: boolean;
  /** TDS the customer withheld from this payment and deposited with the tax office. */
  withheldTax?: { amount: number; certificateNumber: string } | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function writeCollectionActivity(input: {
  paymentId: string;
  invoiceReference: string;
  customerId: string;
  shipmentReference: string | null;
  currency: string;
  amount: number;
  remaining: number;
  actor: Actor;
}) {
  const db = firebaseAdminDb();
  const now = new Date().toISOString();
  const writes: Promise<unknown>[] = [];
  writes.push(db.collection("customers").doc(input.customerId).collection("activity").doc(`invoice-${input.paymentId}`).set({
    type: "finance_activity", title: `Payment recorded: ${input.invoiceReference}`,
    detail: `${input.currency} ${input.amount.toFixed(2)} received · ${input.currency} ${input.remaining.toFixed(2)} remaining`,
    actor_name: input.actor.name, actor_email: input.actor.email, created_at: now,
  }, { merge: true }));
  if (input.shipmentReference) {
    writes.push(db.collection("shipments").doc(input.shipmentReference).collection("job_activity").doc(`invoice-${input.paymentId}`).set({
      type: "finance_activity", title: `Payment recorded: ${input.invoiceReference}`,
      detail: `${input.currency} ${input.amount.toFixed(2)} received`, actor_name: input.actor.name, actor_email: input.actor.email, created_at: now,
    }, { merge: true }));
  }
  await Promise.all(writes.map((write) => write.catch(() => undefined)));
}

export async function recordReceivablePaymentWithSettlementIntegrity(reference: string, input: PaymentInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const normalizedReference = reference.trim().toUpperCase();
  if (!normalizedReference) return { kind: "missing" as const };
  if (!financePaymentMethods.includes(input.method)) return { kind: "invalid_method" as const };
  const paymentDate = input.paymentDate.trim() || operationalDate();
  if (!validDate(paymentDate)) return { kind: "invalid_payment_date" as const };
  const requestCurrency = input.currency ? normalizeSettlementCurrency(input.currency) : null;
  if (requestCurrency && !crmCurrencies.includes(requestCurrency as (typeof crmCurrencies)[number])) return { kind: "invalid_currency" as const };

  const db = firebaseAdminDb();
  const invoiceRef = db.collection("invoices").doc(normalizedReference);
  const outcome = await db.runTransaction(async (transaction) => {
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists) return { kind: "missing" as const };
    const invoice = invoiceSnapshot.data() as Record<string, unknown>;
    const branch = strictBranchValue(invoice.branch);
    if (!branch || !canAccessBranchValue(context, branch)) return { kind: "forbidden" as const };

    const customerId = text(invoice.customer_id).trim().toUpperCase();
    if (!customerId) return { kind: "relationship_mismatch" as const };
    const shipmentReference = nullable(invoice.shipment_reference)?.toUpperCase() ?? null;
    const [customer, shipment] = await Promise.all([
      transaction.get(db.collection("customers").doc(customerId)),
      shipmentReference ? transaction.get(db.collection("shipments").doc(shipmentReference)) : Promise.resolve(null),
    ]);
    if (!customer.exists || !compatibleRecordBranches(branch, customer.get("primary_branch"))) return { kind: "relationship_mismatch" as const };
    if (shipmentReference && (!shipment?.exists || !compatibleRecordBranches(branch, shipment.get("primary_branch")))) {
      return { kind: "relationship_mismatch" as const };
    }
    if (shipment?.exists) {
      const shipmentCustomerId = text(shipment.get("customer_id")).trim().toUpperCase();
      if (shipmentCustomerId && shipmentCustomerId !== customerId) return { kind: "relationship_mismatch" as const };
    }

    const invoiceCurrency = normalizeSettlementCurrency(invoice.currency);
    if (!invoiceCurrency || !crmCurrencies.includes(invoiceCurrency as (typeof crmCurrencies)[number])) return { kind: "invalid_financial_state" as const };
    if (requestCurrency && !settlementCurrenciesMatch(requestCurrency, invoiceCurrency)) return { kind: "currency_mismatch" as const };

    // A retry is recognised before the balance is checked again: the first
    // attempt already moved the balance, so a double-click or network retry
    // used to be refused as an overpayment or as already paid.
    const requestFingerprint = settlementRequestFingerprint({
      accountReference: normalizedReference, amount: input.amount, currency: invoiceCurrency, paymentDate, method: input.method,
      externalReference: input.withheldTax?.amount ? `${input.reference}|tds:${input.withheldTax.amount}` : input.reference,
    });
    const paymentId = paymentDocumentId(normalizedReference, input.idempotencyKey?.trim() ?? "");
    const paymentRef = invoiceRef.collection("payments").doc(paymentId);
    const existingPayment = await transaction.get(paymentRef);
    if (existingPayment.exists) {
      if (text(existingPayment.get("request_fingerprint")) === requestFingerprint) {
        return {
          kind: "idempotent" as const, paymentId, customerId, shipmentReference,
          currency: invoiceCurrency, amount: numberValue(existingPayment.get("amount")), remaining: numberValue(existingPayment.get("balance_after")),
        };
      }
      return { kind: "idempotency_conflict" as const };
    }
    // Money can't be dated into a month whose VAT return is filed.
    const locked = await lockedVatPeriod([paymentDate], transaction);
    if (locked) return { kind: "period_locked" as const, period: locked.label };

    const currentStatus = text(invoice.status);
    const keepExcess = input.keepExcessAsCredit === true;
    const outstanding = numberValue(invoice.balance_due);
    const settled = currentStatus === "paid" || outstanding <= 0;
    const tdsRequested = input.withheldTax?.amount ?? 0;
    // Money for an invoice already settled (paid twice, say) can still be
    // received, but only into the customer's credit, and only when asked.
    // TDS can never be withheld from nothing.
    if (settled && (!keepExcess || tdsRequested > 0)) return { kind: "already_paid" as const };
    if (!["issued", "partially_paid", "overdue", ...(keepExcess ? ["paid"] : [])].includes(currentStatus)) return { kind: "invalid_status" as const };
    const split = settlementWithTds(settled ? 0 : outstanding, input.amount, tdsRequested, keepExcess);
    if (!split.ok) return { kind: split.reason === "overpayment" ? "overpayment" as const : "invalid_amount" as const };
    const allocation = { amount: split.cash, applied: split.applied, excess: split.excess };

    let nextPaid = numberValue(invoice.amount_paid);
    let nextOutstanding = settled ? 0 : outstanding;
    let basisAmount = numberValue(invoice.settlement_basis_amount) || numberValue(invoice.total);
    if (allocation.applied > 0) {
      const basis = resolveSettlementBasis({
        subtotal: invoice.subtotal, taxes: invoice.tax_total, adjustments: invoice.adjustment_total, credits: invoice.credit_total,
        storedTotal: invoice.total, amountAlreadyPaid: invoice.amount_paid, storedOutstanding: invoice.balance_due,
      });
      if (!basis.ok) return { kind: "invalid_financial_state" as const };
      const applied = applySettlementPayment(basis.basis, allocation.applied);
      if (!applied.ok) return { kind: applied.reason === "overpayment" ? "overpayment" as const : "invalid_amount" as const };
      nextPaid = applied.nextPaid;
      nextOutstanding = applied.nextOutstanding;
      basisAmount = basis.basis.totalPayable;
    }

    const now = new Date().toISOString();
    const nextStatus = nextOutstanding <= 0.00001 ? "paid" : text(invoice.due_date) < operationalDate() ? "overdue" : "partially_paid";
    const creditId = allocation.excess > 0 ? `credit-${paymentId}` : null;
    // TDS is its own row: it settles the invoice but no cash came in. With no
    // cash at all, it takes the payment's own id so a retry is still caught.
    const tdsRowId = split.tds > 0 ? (split.cash > 0 ? `${paymentId}-tds` : paymentId) : null;
    if (tdsRowId) {
      const certificateNumber = (input.withheldTax?.certificateNumber ?? "").trim().slice(0, 120);
      transaction.create(invoiceRef.collection("payments").doc(tdsRowId), {
        kind: "tds_withheld", invoice_reference: normalizedReference, amount: split.tds, currency: invoiceCurrency, payment_date: paymentDate,
        method: "adjustment", reference: certificateNumber || null, notes: "TDS withheld by the customer", tds_certificate_number: certificateNumber || null,
        request_fingerprint: requestFingerprint, idempotency_key: input.idempotencyKey?.trim() || null,
        recorded_by_name: actor.name, recorded_by_email: actor.email, created_at: now,
      });
      writeWithheldTax(transaction, {
        id: `invoice-${normalizedReference}-${tdsRowId}`, direction: "by_customer", documentKind: "invoice", documentReference: normalizedReference,
        documentNumber: text(invoice.tax_invoice_number) || normalizedReference, ledgerRowId: tdsRowId, counterpartyId: customerId,
        counterpartyName: text(invoice.customer_name, "Customer"), counterpartyPan: nullable(invoice.customer_tax_id), branch, currency: invoiceCurrency,
        amount: split.tds, settledAmount: split.applied, withheldOn: paymentDate, certificateNumber, actor, now,
      });
    }
    if (split.cash > 0) transaction.create(paymentRef, {
      kind: "payment",
      invoice_reference: normalizedReference, amount: allocation.amount, currency: invoiceCurrency, payment_date: paymentDate, method: input.method,
      reference: input.reference.trim() || null, notes: input.notes.trim() || null, request_fingerprint: requestFingerprint,
      idempotency_key: input.idempotencyKey?.trim() || null, balance_before: settled ? 0 : outstanding,
      balance_after: nextOutstanding, applied_amount: Math.round((allocation.applied - split.tds) * 100) / 100, excess_to_credit: allocation.excess, customer_credit_id: creditId,
      settlement_basis_amount: basisAmount, settlement_basis_currency: invoiceCurrency,
      settlement_basis_version: 1, recorded_by_name: actor.name, recorded_by_email: actor.email, created_at: now,
    });
    if (creditId) {
      const invoiceNumber = text(invoice.tax_invoice_number) || normalizedReference;
      writeNewCustomerCredit(transaction, {
        id: creditId, customerId, customerName: text(invoice.customer_name, "Customer"), branch, currency: invoiceCurrency,
        amount: allocation.excess, source: "overpayment", sourceInvoiceReference: normalizedReference, sourceInvoiceNumber: invoiceNumber,
        sourceDocument: input.reference.trim() || null, note: input.notes.trim() || null, actor, now,
      });
      writeMovedToCredit(transaction, invoiceRef, {
        id: `${paymentId}-to-credit`, invoiceReference: normalizedReference, amount: allocation.excess, currency: invoiceCurrency,
        creditId, date: paymentDate, note: "Paid more than was owed: the rest is the customer's credit", actor, now,
      });
    }
    transaction.update(invoiceRef, {
      amount_paid: nextPaid, balance_due: nextOutstanding, status: nextStatus,
      payment_status: nextOutstanding <= 0.00001 ? "paid" : "partially_paid", last_payment_id: paymentId,
      last_payment_at: now, last_payment_by_name: actor.name, last_payment_by_email: actor.email,
      ...(creditId ? { moved_to_credit_total: Math.round((numberValue(invoice.moved_to_credit_total) + allocation.excess) * 100) / 100 } : {}),
      settlement_basis_amount: basisAmount, settlement_basis_currency: invoiceCurrency, settlement_basis_version: 1, updated_at: now,
    });
    const applied = { amount: allocation.amount, nextOutstanding, excess: allocation.excess, creditId };
    return {
      kind: "updated" as const, paymentId, customerId, shipmentReference,
      currency: invoiceCurrency, amount: applied.amount, remaining: applied.nextOutstanding,
      excessToCredit: applied.excess, customerCreditId: applied.creditId, tds: split.tds,
    };
  });

  if (outcome.kind === "updated") {
    await recomputeCustomerFinance(outcome.customerId).catch(() => undefined);
    await writeCollectionActivity({
      paymentId: outcome.paymentId, invoiceReference: normalizedReference, customerId: outcome.customerId,
      shipmentReference: outcome.shipmentReference, currency: outcome.currency, amount: outcome.amount, remaining: outcome.remaining, actor,
    });
  }
  return outcome;
}