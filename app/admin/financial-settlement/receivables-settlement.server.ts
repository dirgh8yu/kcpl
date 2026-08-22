import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue } from "../branch-access-policy";
import { crmCurrencies } from "../crm/crm-data";
import { financePaymentMethods, type FinancePaymentMethod } from "../finance/finance-data";
import { recomputeCustomerFinance } from "../finance/finance.server";
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
    if (!context.permissions.canManageFinance || !canAccessBranchValue(context, invoice.branch)) return { kind: "forbidden" as const };
    const currentStatus = text(invoice.status);
    if (currentStatus === "paid" || numberValue(invoice.balance_due) <= 0) return { kind: "already_paid" as const };
    if (!["issued", "partially_paid", "overdue"].includes(currentStatus)) return { kind: "invalid_status" as const };

    const invoiceCurrency = normalizeSettlementCurrency(invoice.currency);
    if (!invoiceCurrency || !crmCurrencies.includes(invoiceCurrency as (typeof crmCurrencies)[number])) return { kind: "invalid_financial_state" as const };
    if (requestCurrency && !settlementCurrenciesMatch(requestCurrency, invoiceCurrency)) return { kind: "currency_mismatch" as const };
    const basis = resolveSettlementBasis({
      subtotal: invoice.subtotal, taxes: invoice.tax_total, adjustments: invoice.adjustment_total, credits: invoice.credit_total,
      storedTotal: invoice.total, amountAlreadyPaid: invoice.amount_paid, storedOutstanding: invoice.balance_due,
    });
    if (!basis.ok) return { kind: "invalid_financial_state" as const };
    const applied = applySettlementPayment(basis.basis, input.amount);
    if (!applied.ok) return { kind: applied.reason === "overpayment" ? "overpayment" as const : "invalid_amount" as const };

    const requestFingerprint = settlementRequestFingerprint({
      accountReference: normalizedReference, amount: applied.amount, currency: invoiceCurrency, paymentDate, method: input.method,
      externalReference: input.reference,
    });
    const paymentId = paymentDocumentId(normalizedReference, input.idempotencyKey?.trim() ?? "", requestFingerprint);
    const paymentRef = invoiceRef.collection("payments").doc(paymentId);
    const existingPayment = await transaction.get(paymentRef);
    if (existingPayment.exists) {
      if (text(existingPayment.get("request_fingerprint")) === requestFingerprint) {
        return {
          kind: "idempotent" as const, paymentId, customerId: text(invoice.customer_id), shipmentReference: nullable(invoice.shipment_reference),
          currency: invoiceCurrency, amount: numberValue(existingPayment.get("amount")), remaining: numberValue(existingPayment.get("balance_after")),
        };
      }
      return { kind: "idempotency_conflict" as const };
    }

    const now = new Date().toISOString();
    const nextStatus = applied.nextOutstanding <= 0.00001 ? "paid" : text(invoice.due_date) < operationalDate() ? "overdue" : "partially_paid";
    transaction.create(paymentRef, {
      invoice_reference: normalizedReference, amount: applied.amount, currency: invoiceCurrency, payment_date: paymentDate, method: input.method,
      reference: input.reference.trim() || null, notes: input.notes.trim() || null, request_fingerprint: requestFingerprint,
      idempotency_key: input.idempotencyKey?.trim() || requestFingerprint, balance_before: basis.basis.outstandingAmount,
      balance_after: applied.nextOutstanding, settlement_basis_amount: basis.basis.totalPayable, settlement_basis_currency: invoiceCurrency,
      settlement_basis_version: 1, recorded_by_name: actor.name, recorded_by_email: actor.email, created_at: now,
    });
    transaction.update(invoiceRef, {
      amount_paid: applied.nextPaid, balance_due: applied.nextOutstanding, status: nextStatus,
      payment_status: applied.nextOutstanding <= 0.00001 ? "paid" : "partially_paid", last_payment_id: paymentId,
      last_payment_at: now, last_payment_by_name: actor.name, last_payment_by_email: actor.email,
      settlement_basis_amount: basis.basis.totalPayable, settlement_basis_currency: invoiceCurrency, settlement_basis_version: 1, updated_at: now,
    });
    return {
      kind: "updated" as const, paymentId, customerId: text(invoice.customer_id), shipmentReference: nullable(invoice.shipment_reference),
      currency: invoiceCurrency, amount: applied.amount, remaining: applied.nextOutstanding,
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
