/*
 * Refunds and customer credit, the rules only: no Firebase, so they can be
 * tested and the routes, pages and portal share one reading of them.
 *
 * Money a customer paid that KCPL no longer earns becomes the customer's
 * credit. It comes from a credit note on an invoice that was already paid,
 * or from a payment larger than what was owed. A credit is then paid back
 * (a refund, approved by Management) or used on another of the customer's
 * invoices. Invoices themselves stay as they were: what they record as paid
 * never exceeds their total.
 */

export const customerCreditSources = ["credit_note", "overpayment", "advance"] as const;
export type CustomerCreditSource = (typeof customerCreditSources)[number];

export const customerCreditSourceLabels: Record<CustomerCreditSource, string> = {
  credit_note: "Credit note on a paid invoice",
  overpayment: "Paid more than was owed",
  advance: "Advance payment",
};

/** How a refund goes out: any way a payment comes in, except a book adjustment. */
export const refundMethods = ["bank_transfer", "cash", "cheque", "wallet", "card", "other"] as const;
export type RefundMethod = (typeof refundMethods)[number];

export const refundStatuses = ["requested", "approved", "paid", "rejected", "cancelled"] as const;
export type RefundStatus = (typeof refundStatuses)[number];

export const refundStatusLabels: Record<RefundStatus, string> = {
  requested: "Waiting for approval",
  approved: "Approved, to pay",
  paid: "Paid",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/**
 * What a row in an invoice's payments is. A payment is money received; a
 * credit applied is the customer's credit used here; moved to credit takes
 * money already received off this invoice and into the customer's credit
 * (it is negative); TDS withheld is tax the customer kept back and paid to
 * the tax office for KCPL. The invoice's amount_paid is their sum.
 */
export const invoiceLedgerKinds = ["payment", "credit_applied", "moved_to_credit", "tds_withheld"] as const;
export type InvoiceLedgerKind = (typeof invoiceLedgerKinds)[number];

export function invoiceLedgerKind(value: unknown): InvoiceLedgerKind {
  return value === "credit_applied" || value === "moved_to_credit" || value === "tds_withheld" ? value : "payment";
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function amountValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = money(parsed);
  return rounded > 0 && Math.abs(parsed - rounded) < 0.005 ? rounded : null;
}

/**
 * A credit note against an invoice: the part that comes off what is still
 * owed, and the part, already paid, that becomes the customer's credit. A
 * credit note can take back the whole invoice but never more.
 */
export function creditNoteAllocation(invoice: { total: number; balance_due: number }, requested: unknown):
  | { ok: true; amount: number; fromBalance: number; toCustomerCredit: number }
  | { ok: false; reason: "invalid_amount" | "exceeds_total" } {
  const amount = amountValue(requested);
  if (amount === null) return { ok: false, reason: "invalid_amount" };
  if (amount - invoice.total > 0.005) return { ok: false, reason: "exceeds_total" };
  const fromBalance = money(Math.min(amount, Math.max(0, invoice.balance_due)));
  return { ok: true, amount, fromBalance, toCustomerCredit: money(amount - fromBalance) };
}

/**
 * Money received for an invoice: applied up to what is owed. Anything over
 * is refused unless accounts chose to keep it as the customer's credit, so a
 * mistyped extra zero is caught rather than banked.
 */
export function paymentAllocation(outstanding: number, requested: unknown, keepExcessAsCredit: boolean):
  | { ok: true; amount: number; applied: number; excess: number }
  | { ok: false; reason: "invalid_amount" | "overpayment" } {
  const amount = amountValue(requested);
  if (amount === null) return { ok: false, reason: "invalid_amount" };
  const owed = money(Math.max(0, outstanding));
  if (amount - owed > 0.005 && !keepExcessAsCredit) return { ok: false, reason: "overpayment" };
  const applied = money(Math.min(amount, owed));
  return { ok: true, amount, applied, excess: money(amount - applied) };
}

/**
 * One credit held for a customer. What it started as is always accounted
 * for: available + reserved (in refunds not yet paid) + refunded + applied.
 */
export type CustomerCreditBalance = {
  amount: number;
  available: number;
  reserved: number;
  refunded: number;
  applied: number;
};

export function customerCreditConsistent(credit: CustomerCreditBalance) {
  const parts = [credit.available, credit.reserved, credit.refunded, credit.applied];
  if (credit.amount <= 0 || parts.some((part) => !Number.isFinite(part) || part < -0.005)) return false;
  return Math.abs(money(parts.reduce((sum, part) => sum + part, 0)) - money(credit.amount)) < 0.005;
}

export function customerCreditOpen(credit: Pick<CustomerCreditBalance, "available" | "reserved">) {
  return credit.available + credit.reserved > 0.005;
}

type CreditMove =
  | { ok: true; amount: number; next: CustomerCreditBalance }
  | { ok: false; reason: "invalid_amount" | "exceeds_available" | "inconsistent_credit" };

function move(credit: CustomerCreditBalance, requested: unknown, from: "available" | "reserved", to: keyof CustomerCreditBalance, limit = Number.POSITIVE_INFINITY): CreditMove {
  if (!customerCreditConsistent(credit)) return { ok: false, reason: "inconsistent_credit" };
  const amount = amountValue(requested);
  if (amount === null) return { ok: false, reason: "invalid_amount" };
  if (amount - Math.min(credit[from], limit) > 0.005) return { ok: false, reason: "exceeds_available" };
  const next = { ...credit, [from]: money(credit[from] - amount), [to]: money(credit[to] + amount) };
  return { ok: true, amount, next };
}

/** A refund asked for holds its amount, so the same money can't be refunded twice or used elsewhere meanwhile. */
export function reserveForRefund(credit: CustomerCreditBalance, amount: unknown) {
  return move(credit, amount, "available", "reserved");
}

/** A refund rejected or cancelled gives its amount back to the credit. */
export function releaseRefund(credit: CustomerCreditBalance, amount: unknown) {
  return move(credit, amount, "reserved", "available");
}

/** A refund paid out. */
export function settleRefund(credit: CustomerCreditBalance, amount: unknown) {
  return move(credit, amount, "reserved", "refunded");
}

/** Credit used on another invoice, never more than that invoice still owes. */
export function applyCreditToInvoice(credit: CustomerCreditBalance, amount: unknown, invoiceBalance: number) {
  return move(credit, amount, "available", "applied", Math.max(0, invoiceBalance));
}

/** Credit can only settle an invoice of the same customer, in the same currency, that is issued and owes something. */
export function creditUsableOn(
  credit: { customer_id: string; currency: string },
  invoice: { customer_id: string; currency: string; status: string; balance_due: number },
) {
  if (credit.customer_id !== invoice.customer_id) return { ok: false as const, reason: "other_customer" as const };
  if (credit.currency !== invoice.currency) return { ok: false as const, reason: "currency_mismatch" as const };
  if (!["issued", "partially_paid", "overdue"].includes(invoice.status) || invoice.balance_due <= 0.005) return { ok: false as const, reason: "nothing_owed" as const };
  return { ok: true as const };
}

/** Management approve their own requests as they make them; anyone else's waits for Management. */
export function refundInitialStatus(role: string): RefundStatus {
  return role === "management" ? "approved" : "requested";
}

export type RefundAction = "approve" | "reject" | "cancel" | "pay";

/**
 * Who may move a refund on, and to what. Money leaving KCPL is approved by
 * Management and never by the person who asked for it; paying it is
 * recorded by accounts once the bank transfer or cash has gone.
 */
export function refundTransition(
  refund: { status: RefundStatus; requested_by_email: string },
  action: RefundAction,
  actor: { role: string; email: string; canManageFinance: boolean },
):
  | { ok: true; next: RefundStatus; releasesCredit: boolean; settlesCredit: boolean }
  | { ok: false; reason: "invalid_status" | "management_only" | "own_request" | "forbidden" } {
  if (!actor.canManageFinance) return { ok: false, reason: "forbidden" };
  const management = actor.role === "management";
  const own = actor.email.trim().toLowerCase() === refund.requested_by_email.trim().toLowerCase();
  if (action === "approve") {
    if (refund.status !== "requested") return { ok: false, reason: "invalid_status" };
    if (!management) return { ok: false, reason: "management_only" };
    if (own) return { ok: false, reason: "own_request" };
    return { ok: true, next: "approved", releasesCredit: false, settlesCredit: false };
  }
  if (action === "reject") {
    if (refund.status !== "requested" && refund.status !== "approved") return { ok: false, reason: "invalid_status" };
    if (!management) return { ok: false, reason: "management_only" };
    return { ok: true, next: "rejected", releasesCredit: true, settlesCredit: false };
  }
  if (action === "cancel") {
    if (refund.status !== "requested" && refund.status !== "approved") return { ok: false, reason: "invalid_status" };
    if (!management && !own) return { ok: false, reason: "management_only" };
    return { ok: true, next: "cancelled", releasesCredit: true, settlesCredit: false };
  }
  if (refund.status !== "approved") return { ok: false, reason: "invalid_status" };
  return { ok: true, next: "paid", releasesCredit: false, settlesCredit: true };
}

/** Credits and refunds read back from storage, defensively. */
export function customerCreditBalanceFromData(data: Record<string, unknown>): CustomerCreditBalance {
  const value = (key: string) => {
    const parsed = typeof data[key] === "number" ? data[key] as number : Number(data[key]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return { amount: value("amount"), available: value("available"), reserved: value("reserved"), refunded: value("refunded"), applied: value("applied") };
}

export function refundStatusValue(value: unknown): RefundStatus {
  return refundStatuses.includes(value as RefundStatus) ? value as RefundStatus : "requested";
}
