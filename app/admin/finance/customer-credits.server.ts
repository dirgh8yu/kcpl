import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { nepalOperationalDate } from "../../invoice-effective-status";
import { nepalFiscalYear } from "../../nepali-calendar";
import { canAccessBranchValue, strictBranchValue } from "../branch-access-policy";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { applySettlementPayment, resolveSettlementBasis } from "../financial-settlement/settlement-policy";
import { readAllDocuments } from "../firestore-scan";
import { mockCustomerCredits, qaMockDataEnabled } from "../qa-fixtures";
import type { KcplStaffContext } from "../staff-directory.server";
import { CUSTOMER_CREDITS, CUSTOMER_REFUNDS, nextTaxDocumentNumber, writeCreditEvent } from "./customer-credit-ledger.server";
import {
  financePaymentMethods,
  type FinanceCreditEvent,
  type FinanceCustomerCredit,
  type FinancePaymentMethod,
  type FinanceRefund,
} from "./finance-data";
import { recomputeCustomerFinance } from "./finance.server";
import {
  applyCreditToInvoice,
  creditUsableOn,
  customerCreditBalanceFromData,
  customerCreditOpen,
  customerCreditSources,
  refundInitialStatus,
  refundMethods,
  refundStatusValue,
  refundTransition,
  releaseRefund,
  reserveForRefund,
  settleRefund,
  type CustomerCreditBalance,
  type CustomerCreditSource,
  type RefundAction,
} from "./refund-policy";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function currencyValue(value: unknown): CrmCurrency { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : "NPR"; }
function branchValue(value: unknown): KcplBranch { return strictBranchValue(value) ?? "Kathmandu"; }
function eventId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`; }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function creditFromDoc(id: string, data: Record<string, unknown>): FinanceCustomerCredit {
  const balance = customerCreditBalanceFromData(data);
  return {
    id,
    customer_id: text(data.customer_id),
    customer_name: text(data.customer_name, "Customer"),
    branch: branchValue(data.branch),
    currency: currencyValue(data.currency),
    ...balance,
    status: customerCreditOpen(balance) ? "open" : "used",
    source: customerCreditSources.includes(data.source as CustomerCreditSource) ? data.source as CustomerCreditSource : "credit_note",
    source_invoice_reference: text(data.source_invoice_reference),
    source_invoice_number: text(data.source_invoice_number) || text(data.source_invoice_reference),
    source_document: nullable(data.source_document),
    note: nullable(data.note),
    created_by_name: text(data.created_by_name, "KCPL Accounts"),
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
  };
}

function refundFromDoc(id: string, data: Record<string, unknown>): FinanceRefund {
  const method = text(data.method);
  return {
    id,
    number: nullable(data.number),
    credit_id: text(data.credit_id),
    customer_id: text(data.customer_id),
    customer_name: text(data.customer_name, "Customer"),
    branch: branchValue(data.branch),
    currency: currencyValue(data.currency),
    amount: numberValue(data.amount),
    reason: text(data.reason),
    payee_details: nullable(data.payee_details),
    status: refundStatusValue(data.status),
    requested_by_name: text(data.requested_by_name, "KCPL Accounts"),
    requested_by_email: text(data.requested_by_email),
    requested_at: text(data.requested_at),
    decided_by_name: nullable(data.decided_by_name),
    decided_at: nullable(data.decided_at),
    decision_note: nullable(data.decision_note),
    paid_on: nullable(data.paid_on),
    method: financePaymentMethods.includes(method as FinancePaymentMethod) ? method as FinancePaymentMethod : null,
    payment_reference: nullable(data.payment_reference),
    paid_by_name: nullable(data.paid_by_name),
    source_invoice_reference: text(data.source_invoice_reference),
    source_invoice_number: text(data.source_invoice_number) || text(data.source_invoice_reference),
  };
}

function eventFromDoc(id: string, data: Record<string, unknown>): FinanceCreditEvent {
  const kinds: FinanceCreditEvent["kind"][] = ["created", "refund_requested", "refund_approved", "refund_rejected", "refund_cancelled", "refund_paid", "applied"];
  return {
    id,
    kind: kinds.includes(data.kind as FinanceCreditEvent["kind"]) ? data.kind as FinanceCreditEvent["kind"] : "created",
    amount: numberValue(data.amount),
    detail: text(data.detail),
    actor_name: text(data.actor_name, "KCPL Accounts"),
    created_at: text(data.created_at),
    refund_id: nullable(data.refund_id),
    invoice_reference: nullable(data.invoice_reference),
  };
}

function balanceWrite(balance: CustomerCreditBalance, now: string) {
  return { ...balance, status: customerCreditOpen(balance) ? "open" : "used", updated_at: now };
}

async function writeCustomerActivity(customerId: string, title: string, detail: string, actor: Actor) {
  if (!customerId) return;
  await firebaseAdminDb().collection("customers").doc(customerId).collection("activity").doc(eventId("activity")).create({
    type: "finance_activity", title, detail, actor_name: actor.name, actor_email: actor.email, created_at: new Date().toISOString(),
  }).catch(() => undefined);
}

export type CreditsOverview = {
  credits: FinanceCustomerCredit[];
  /** Refunds waiting for approval or payment, then the latest settled ones. */
  refunds: FinanceRefund[];
};

/** Open credits and refunds in the branches this person can see. */
export async function listCustomerCredits(context: KcplStaffContext): Promise<{ kind: "ready"; overview: CreditsOverview } | { kind: "forbidden" } | { kind: "unavailable" }> {
  if (!context.permissions.canManageFinance) return { kind: "forbidden" };
  if (qaMockDataEnabled()) return { kind: "ready", overview: mockCustomerCredits() };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const [credits, open, recent] = await Promise.all([
      readAllDocuments(db.collection(CUSTOMER_CREDITS).where("status", "==", "open")),
      readAllDocuments(db.collection(CUSTOMER_REFUNDS).where("status", "in", ["requested", "approved"])),
      db.collection(CUSTOMER_REFUNDS).orderBy("requested_at", "desc").limit(60).get(),
    ]);
    const seen = new Set<string>();
    const refunds = [...open.docs, ...recent.docs]
      .filter((doc) => !seen.has(doc.id) && Boolean(seen.add(doc.id)))
      .map((doc) => refundFromDoc(doc.id, doc.data() as Record<string, unknown>))
      .filter((refund) => canAccessBranchValue(context, refund.branch));
    return {
      kind: "ready",
      overview: {
        credits: credits.docs
          .map((doc) => creditFromDoc(doc.id, doc.data() as Record<string, unknown>))
          .filter((credit) => canAccessBranchValue(context, credit.branch))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        refunds: refunds.sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
      },
    };
  } catch (error) {
    console.error("KCPL customer credits listing failed", error);
    return { kind: "unavailable" };
  }
}

export type CreditDetail = {
  credit: FinanceCustomerCredit;
  refunds: FinanceRefund[];
  history: FinanceCreditEvent[];
  /** The customer's invoices in the same currency that still owe something, to use the credit on. */
  openInvoices: Array<{ reference: string; number: string; balance_due: number; due_date: string }>;
};

export async function getCustomerCredit(id: string, context: KcplStaffContext): Promise<{ kind: "ready"; detail: CreditDetail } | { kind: "forbidden" } | { kind: "missing" } | { kind: "unavailable" }> {
  if (!context.permissions.canManageFinance) return { kind: "forbidden" };
  if (qaMockDataEnabled()) {
    const mock = mockCustomerCredits();
    const credit = mock.credits.find((item: FinanceCustomerCredit) => item.id === id);
    if (!credit) return { kind: "missing" };
    return { kind: "ready", detail: { credit, refunds: mock.refunds.filter((refund: FinanceRefund) => refund.credit_id === id), history: mock.history[id] ?? [], openInvoices: mock.openInvoices } };
  }
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const snapshot = await db.collection(CUSTOMER_CREDITS).doc(id).get();
    if (!snapshot.exists) return { kind: "missing" };
    const credit = creditFromDoc(snapshot.id, snapshot.data() as Record<string, unknown>);
    if (!canAccessBranchValue(context, credit.branch)) return { kind: "forbidden" };
    const [refunds, history, invoices] = await Promise.all([
      db.collection(CUSTOMER_REFUNDS).where("credit_id", "==", id).get(),
      snapshot.ref.collection("history").orderBy("created_at", "desc").limit(200).get(),
      readAllDocuments(db.collection("invoices").where("customer_id", "==", credit.customer_id)),
    ]);
    return {
      kind: "ready",
      detail: {
        credit,
        refunds: refunds.docs.map((doc) => refundFromDoc(doc.id, doc.data() as Record<string, unknown>)).sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
        history: history.docs.map((doc) => eventFromDoc(doc.id, doc.data() as Record<string, unknown>)),
        openInvoices: invoices.docs
          .filter((doc) => text(doc.get("currency")) === credit.currency && ["issued", "partially_paid", "overdue"].includes(text(doc.get("status"))) && numberValue(doc.get("balance_due")) > 0.005)
          .map((doc) => ({ reference: doc.id, number: text(doc.get("tax_invoice_number")) || text(doc.get("external_invoice_number")) || doc.id, balance_due: numberValue(doc.get("balance_due")), due_date: text(doc.get("due_date")) }))
          .sort((a, b) => a.due_date.localeCompare(b.due_date)),
      },
    };
  } catch (error) {
    console.error("KCPL customer credit read failed", error);
    return { kind: "unavailable" };
  }
}

type RefundRequestInput = { amount: number; reason: string; payeeDetails: string };

/**
 * Ask for part or all of a credit to be paid back. The amount is held from
 * the credit at once, so it can't also be used on an invoice or refunded
 * twice while it waits for Management.
 */
export async function requestRefund(creditId: string, input: RefundRequestInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 4) return { kind: "reason_required" as const };
  const db = firebaseAdminDb();
  const creditRef = db.collection(CUSTOMER_CREDITS).doc(creditId);
  const refundRef = db.collection(CUSTOMER_REFUNDS).doc(eventId("refund"));
  const status = refundInitialStatus(context.profile.role);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(creditRef);
    if (!snapshot.exists) return { kind: "missing" as const };
    const data = snapshot.data() as Record<string, unknown>;
    if (!canAccessBranchValue(context, data.branch)) return { kind: "forbidden" as const };
    const reserved = reserveForRefund(customerCreditBalanceFromData(data), input.amount);
    if (!reserved.ok) return { kind: reserved.reason };
    const now = new Date().toISOString();
    const currency = text(data.currency);
    transaction.create(refundRef, {
      credit_id: creditId, customer_id: text(data.customer_id), customer_name: text(data.customer_name, "Customer"),
      branch: text(data.branch), currency, amount: reserved.amount, reason, payee_details: input.payeeDetails.trim().slice(0, 500) || null,
      status, number: null,
      requested_by_name: actor.name, requested_by_email: actor.email, requested_at: now,
      // Management's own request is their approval.
      decided_by_name: status === "approved" ? actor.name : null, decided_by_email: status === "approved" ? actor.email : null,
      decided_at: status === "approved" ? now : null, decision_note: null,
      source_invoice_reference: text(data.source_invoice_reference), source_invoice_number: text(data.source_invoice_number),
    });
    transaction.update(creditRef, balanceWrite(reserved.next, now));
    writeCreditEvent(transaction, creditId, `${refundRef.id}-requested`, {
      kind: status === "approved" ? "refund_approved" : "refund_requested", amount: reserved.amount,
      detail: status === "approved" ? `Refund of ${money(reserved.amount, currency)} asked for and approved · ${reason}` : `Refund of ${money(reserved.amount, currency)} asked for · ${reason}`,
      refund_id: refundRef.id, invoice_reference: null,
    }, actor, now);
    return { kind: "created" as const, refundId: refundRef.id, status, customerId: text(data.customer_id), amount: reserved.amount, currency };
  });
  if (result.kind === "created") {
    await recomputeCustomerFinance(result.customerId).catch(() => undefined);
    await writeCustomerActivity(result.customerId, "Refund asked for", `${money(result.amount, result.currency)} · ${reason}`, actor);
  }
  return result;
}

type RefundMoveInput = { note?: string; paidOn?: string; method?: string; paymentReference?: string };

/** Approve, reject, cancel or record as paid. */
export async function moveRefund(refundId: string, action: RefundAction, input: RefundMoveInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const note = (input.note ?? "").trim().slice(0, 500);
  if (action === "reject" && note.length < 4) return { kind: "note_required" as const };
  const today = nepalOperationalDate();
  const paidOn = (input.paidOn ?? "").trim() || today;
  const method = (input.method ?? "").trim();
  const paymentReference = (input.paymentReference ?? "").trim().slice(0, 200);
  if (action === "pay") {
    if (!validDate(paidOn) || paidOn > today) return { kind: "invalid_date" as const };
    if (!(refundMethods as readonly string[]).includes(method)) return { kind: "invalid_method" as const };
    if (method !== "cash" && !paymentReference) return { kind: "reference_required" as const };
  }
  const fiscalYear = nepalFiscalYear(paidOn);
  if (action === "pay" && !fiscalYear) return { kind: "invalid_date" as const };

  const db = firebaseAdminDb();
  const refundRef = db.collection(CUSTOMER_REFUNDS).doc(refundId);
  const result = await db.runTransaction(async (transaction) => {
    const refundSnapshot = await transaction.get(refundRef);
    if (!refundSnapshot.exists) return { kind: "missing" as const };
    const refund = refundFromDoc(refundSnapshot.id, refundSnapshot.data() as Record<string, unknown>);
    if (!canAccessBranchValue(context, refund.branch)) return { kind: "forbidden" as const };
    const transition = refundTransition(refund, action, { role: context.profile.role, email: actor.email, canManageFinance: context.permissions.canManageFinance });
    if (!transition.ok) return { kind: transition.reason };
    const creditRef = db.collection(CUSTOMER_CREDITS).doc(refund.credit_id);
    const creditSnapshot = await transaction.get(creditRef);
    if (!creditSnapshot.exists) return { kind: "missing" as const };
    const series = action === "pay" && fiscalYear ? await nextTaxDocumentNumber(transaction, "refund", fiscalYear) : null;
    let balance = customerCreditBalanceFromData(creditSnapshot.data() as Record<string, unknown>);
    if (transition.releasesCredit || transition.settlesCredit) {
      const moved = transition.settlesCredit ? settleRefund(balance, refund.amount) : releaseRefund(balance, refund.amount);
      if (!moved.ok) return { kind: "inconsistent_credit" as const };
      balance = moved.next;
    }
    const now = new Date().toISOString();
    series?.commit();
    transaction.update(refundRef, {
      status: transition.next,
      ...(action === "pay"
        ? { number: series?.number ?? null, sequence: series?.sequence ?? null, fiscal_year: fiscalYear, paid_on: paidOn, method, payment_reference: paymentReference || null, paid_by_name: actor.name, paid_by_email: actor.email, paid_at: now }
        : { decided_by_name: actor.name, decided_by_email: actor.email, decided_at: now, decision_note: note || null }),
      updated_at: now,
    });
    if (transition.releasesCredit || transition.settlesCredit) transaction.update(creditRef, balanceWrite(balance, now));
    const amount = money(refund.amount, refund.currency);
    const detail = action === "pay"
      ? `Refund ${series?.number ?? ""} of ${amount} paid ${paidOn}${paymentReference ? ` · ${paymentReference}` : ""}`
      : action === "approve" ? `Refund of ${amount} approved${note ? ` · ${note}` : ""}`
        : action === "reject" ? `Refund of ${amount} rejected · ${note}` : `Refund of ${amount} cancelled${note ? ` · ${note}` : ""}`;
    writeCreditEvent(transaction, refund.credit_id, `${refundId}-${action}`, {
      kind: action === "pay" ? "refund_paid" : action === "approve" ? "refund_approved" : action === "reject" ? "refund_rejected" : "refund_cancelled",
      amount: refund.amount, detail, refund_id: refundId, invoice_reference: null,
    }, actor, now);
    return { kind: "updated" as const, status: transition.next, number: series?.number ?? null, customerId: refund.customer_id, detail };
  });
  if (result.kind === "updated") {
    await recomputeCustomerFinance(result.customerId).catch(() => undefined);
    await writeCustomerActivity(result.customerId, action === "pay" ? `Refund paid${result.number ? `: ${result.number}` : ""}` : "Refund updated", result.detail, actor);
  }
  return result;
}

/**
 * Use a credit to pay another of the customer's invoices. Recorded on that
 * invoice as a credit applied, through the same settlement checks as a
 * payment, and never more than it still owes.
 */
export async function applyCustomerCredit(creditId: string, input: { invoiceReference: string; amount: number }, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const invoiceReference = input.invoiceReference.trim().toUpperCase();
  if (!invoiceReference) return { kind: "missing" as const };
  const db = firebaseAdminDb();
  const creditRef = db.collection(CUSTOMER_CREDITS).doc(creditId);
  const invoiceRef = db.collection("invoices").doc(invoiceReference);
  const ledgerId = eventId("credit-applied");
  const today = nepalOperationalDate();
  const result = await db.runTransaction(async (transaction) => {
    const [creditSnapshot, invoiceSnapshot] = await Promise.all([transaction.get(creditRef), transaction.get(invoiceRef)]);
    if (!creditSnapshot.exists || !invoiceSnapshot.exists) return { kind: "missing" as const };
    const credit = creditSnapshot.data() as Record<string, unknown>;
    const invoice = invoiceSnapshot.data() as Record<string, unknown>;
    if (!canAccessBranchValue(context, credit.branch) || !canAccessBranchValue(context, invoice.branch)) return { kind: "forbidden" as const };
    const usable = creditUsableOn(
      { customer_id: text(credit.customer_id), currency: text(credit.currency) },
      { customer_id: text(invoice.customer_id), currency: text(invoice.currency), status: text(invoice.status), balance_due: numberValue(invoice.balance_due) },
    );
    if (!usable.ok) return { kind: usable.reason };
    const moved = applyCreditToInvoice(customerCreditBalanceFromData(credit), input.amount, numberValue(invoice.balance_due));
    if (!moved.ok) return { kind: moved.reason };
    const basis = resolveSettlementBasis({
      subtotal: invoice.subtotal, taxes: invoice.tax_total, adjustments: invoice.adjustment_total, credits: invoice.credit_total,
      storedTotal: invoice.total, amountAlreadyPaid: invoice.amount_paid, storedOutstanding: invoice.balance_due,
    });
    if (!basis.ok) return { kind: "invalid_financial_state" as const };
    const applied = applySettlementPayment(basis.basis, moved.amount);
    if (!applied.ok) return { kind: "exceeds_available" as const };
    const now = new Date().toISOString();
    const currency = text(invoice.currency);
    const invoiceNumber = text(invoice.tax_invoice_number) || invoiceReference;
    const sourceNumber = text(credit.source_invoice_number) || text(credit.source_invoice_reference);
    transaction.create(invoiceRef.collection("payments").doc(ledgerId), {
      kind: "credit_applied", invoice_reference: invoiceReference, amount: moved.amount, currency, payment_date: today, method: "adjustment",
      reference: `Credit from ${sourceNumber}`, notes: null, customer_credit_id: creditId,
      balance_before: basis.basis.outstandingAmount, balance_after: applied.nextOutstanding,
      settlement_basis_amount: basis.basis.totalPayable, settlement_basis_currency: currency, settlement_basis_version: 1,
      recorded_by_name: actor.name, recorded_by_email: actor.email, created_at: now,
    });
    const nextStatus = applied.nextOutstanding <= 0.00001 ? "paid" : text(invoice.due_date) < today ? "overdue" : "partially_paid";
    transaction.update(invoiceRef, {
      amount_paid: applied.nextPaid, balance_due: applied.nextOutstanding, status: nextStatus,
      payment_status: applied.nextOutstanding <= 0.00001 ? "paid" : "partially_paid", last_payment_id: ledgerId, last_payment_at: now,
      last_payment_by_name: actor.name, last_payment_by_email: actor.email,
      settlement_basis_amount: basis.basis.totalPayable, settlement_basis_currency: currency, settlement_basis_version: 1, updated_at: now,
    });
    transaction.update(creditRef, balanceWrite(moved.next, now));
    writeCreditEvent(transaction, creditId, `${ledgerId}-applied`, {
      kind: "applied", amount: moved.amount, detail: `${money(moved.amount, currency)} used on ${invoiceNumber}`, refund_id: null, invoice_reference: invoiceReference,
    }, actor, now);
    return { kind: "applied" as const, customerId: text(invoice.customer_id), amount: moved.amount, currency, invoiceNumber, remaining: applied.nextOutstanding };
  });
  if (result.kind === "applied") {
    await recomputeCustomerFinance(result.customerId).catch(() => undefined);
    await writeCustomerActivity(result.customerId, `Credit used on ${result.invoiceNumber}`, `${money(result.amount, result.currency)} · ${money(result.remaining, result.currency)} still owed`, actor);
  }
  return result;
}
