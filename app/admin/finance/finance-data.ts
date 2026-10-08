import type { CrmCurrency, KcplBranch } from "../crm/crm-data";

export const financeInvoiceStatuses = ["draft", "issued", "partially_paid", "paid", "overdue", "void"] as const;
export type FinanceInvoiceStatus = (typeof financeInvoiceStatuses)[number];

export const financePaymentMethods = ["bank_transfer", "cash", "card", "cheque", "wallet", "adjustment", "other"] as const;
export type FinancePaymentMethod = (typeof financePaymentMethods)[number];

export type FinanceReceivableRecordType = "invoice" | "opening_balance";

export const financeInvoiceStatusLabels: Record<FinanceInvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const financePaymentMethodLabels: Record<FinancePaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  cheque: "Cheque",
  wallet: "Digital wallet",
  adjustment: "Adjustment",
  other: "Other",
};

/**
 * A service line is KCPL's charge and carries VAT as chosen. A disbursement
 * is money paid for the customer (customs duty, port charges) and passed on
 * at cost: no VAT, and not KCPL's revenue.
 */
export const invoiceLineKinds = ["service", "disbursement"] as const;
export type InvoiceLineKind = (typeof invoiceLineKinds)[number];

export type FinanceInvoiceLine = {
  id: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
};

/** A credit note: part of an issued invoice withdrawn, with its own number. */
export type FinanceCreditNote = {
  id: string;
  number: string;
  invoice_reference: string;
  credit_date: string;
  amount: number;
  tax_amount: number;
  disbursement_amount: number;
  reason: string;
  created_by_name: string;
  created_at: string;
};

export type FinancePayment = {
  id: string;
  invoice_reference: string;
  amount: number;
  currency: CrmCurrency;
  payment_date: string;
  method: FinancePaymentMethod;
  reference: string | null;
  notes: string | null;
  recorded_by_name: string;
  recorded_by_email: string;
  created_at: string;
};

export type FinanceInvoice = {
  reference: string;
  record_type: FinanceReceivableRecordType;
  external_invoice_number: string | null;
  migration_batch_id: string | null;
  migration_as_of_date: string | null;
  customer_id: string;
  customer_name: string;
  shipment_reference: string | null;
  quote_reference: string | null;
  branch: KcplBranch;
  status: FinanceInvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: CrmCurrency;
  line_items: FinanceInvoiceLine[];
  subtotal: number;
  tax_total: number;
  /** Paid for the customer at cost; inside subtotal and total. */
  disbursement_total: number;
  /** Withdrawn by credit notes; total and balance are already net of it. */
  credit_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  /** "KCPL/2083-84/00012": given in sequence when the invoice is issued. */
  tax_invoice_number: string | null;
  fiscal_year: string | null;
  /** KCPL's PAN and the customer's, as they were when it was issued. */
  seller_pan: string | null;
  customer_tax_id: string | null;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  payments: FinancePayment[];
  credit_notes: FinanceCreditNote[];
};

export type FinanceCurrencySummary = {
  currency: CrmCurrency;
  invoiced: number;
  opening_balance: number;
  collected: number;
  outstanding: number;
  overdue: number;
  aging_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_90_plus: number;
  invoice_count: number;
  opening_balance_count: number;
};

/** A delivered shipment with no issued invoice: work done and not yet billed. */
export type FinanceToInvoiceRow = {
  reference: string;
  customer_id: string | null;
  customer_name: string | null;
  branch: string;
  delivered_on: string | null;
  draft_invoice_count: number;
};

export type FinanceDashboard = {
  generated_at: string;
  invoices: FinanceInvoice[];
  currency_summaries: FinanceCurrencySummary[];
  overdue_count: number;
  unpaid_count: number;
  paid_count: number;
  draft_count: number;
  opening_balance_count: number;
  /** Delivered shipments not yet invoiced, longest-waiting first. */
  to_invoice: FinanceToInvoiceRow[];
};

/** Issued (sent, part-paid, paid, overdue) and draft invoices among a shipment's invoices. */
export function shipmentBillingCounts(statuses: readonly string[]) {
  let issued = 0;
  let draft = 0;
  for (const status of statuses) {
    if (status === "draft") draft += 1;
    else if (status && status !== "void") issued += 1;
  }
  return { issued, draft };
}

export type CreateFinanceInvoiceInput = {
  customerId: string;
  shipmentReference: string;
  issueDate: string;
  dueDate: string;
  currency: CrmCurrency;
  lines: InvoiceLineInput[];
  notes: string;
};

export type InvoiceLineInput = {
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

export const INVOICE_MAX_LINES = 40;

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Lines priced and totalled the one way the server stores them. A
 * disbursement never carries VAT, whatever rate was sent with it.
 */
export function invoiceTotals(lines: readonly InvoiceLineInput[]):
  | { ok: true; lines: Array<Omit<FinanceInvoiceLine, "id">>; subtotal: number; tax_total: number; disbursement_total: number; total: number }
  | { ok: false; reason: "no_lines" | "too_many_lines" | "invalid_amount" | "invalid_tax" } {
  if (!lines.length) return { ok: false, reason: "no_lines" };
  if (lines.length > INVOICE_MAX_LINES) return { ok: false, reason: "too_many_lines" };
  const priced: Array<Omit<FinanceInvoiceLine, "id">> = [];
  for (const line of lines) {
    const kind: InvoiceLineKind = line.kind === "disbursement" ? "disbursement" : "service";
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const taxRate = kind === "disbursement" ? 0 : Number(line.taxRate);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) return { ok: false, reason: "invalid_amount" };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, reason: "invalid_amount" };
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { ok: false, reason: "invalid_tax" };
    const subtotal = round2(quantity * unitPrice);
    const taxAmount = round2(subtotal * (taxRate / 100));
    priced.push({
      kind,
      description: line.description.trim().slice(0, 300) || (kind === "disbursement" ? "Paid on your behalf" : "Freight and logistics services"),
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      subtotal,
      tax_amount: taxAmount,
      total: round2(subtotal + taxAmount),
    });
  }
  const subtotal = round2(priced.reduce((sum, line) => sum + line.subtotal, 0));
  const taxTotal = round2(priced.reduce((sum, line) => sum + line.tax_amount, 0));
  const disbursementTotal = round2(priced.filter((line) => line.kind === "disbursement").reduce((sum, line) => sum + line.subtotal, 0));
  const total = round2(subtotal + taxTotal);
  if (total <= 0) return { ok: false, reason: "invalid_amount" };
  return { ok: true, lines: priced, subtotal, tax_total: taxTotal, disbursement_total: disbursementTotal, total };
}

/** "KCPL/2083-84/00012" for invoices, "KCPL/CN/2083-84/00003" for credit notes. */
export function taxDocumentNumber(kind: "invoice" | "credit_note", fiscalYear: string, sequence: number) {
  return `KCPL/${kind === "credit_note" ? "CN/" : ""}${fiscalYear}/${String(sequence).padStart(5, "0")}`;
}

/**
 * How a credit is split into VAT, at-cost and KCPL's own charge: in the same
 * proportions as what is still on the invoice, so several credits never take
 * back more VAT than the invoice carried. Refused above what is still owed.
 */
export function creditNoteSplit(invoice: {
  total: number; tax_total: number; disbursement_total: number; balance_due: number;
  credit_tax_total?: number; credit_disbursement_total?: number;
}, requested: number):
  | { ok: true; amount: number; tax_amount: number; disbursement_amount: number }
  | { ok: false; reason: "invalid_amount" | "exceeds_balance" } {
  const amount = round2(Number(requested));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "invalid_amount" };
  if (amount - invoice.balance_due > 0.005) return { ok: false, reason: "exceeds_balance" };
  const remainingTax = Math.max(0, invoice.tax_total - (invoice.credit_tax_total ?? 0));
  const remainingDisbursement = Math.max(0, invoice.disbursement_total - (invoice.credit_disbursement_total ?? 0));
  const remainingGross = invoice.total;
  if (remainingGross <= 0) return { ok: false, reason: "exceeds_balance" };
  return {
    ok: true,
    amount,
    tax_amount: round2((amount * remainingTax) / remainingGross),
    disbursement_amount: round2((amount * remainingDisbursement) / remainingGross),
  };
}

/** "Credited" when credit notes, not payments, cleared the invoice. */
export function invoiceStatusLabel(invoice: Pick<FinanceInvoice, "status" | "amount_paid" | "credit_total">) {
  if (invoice.status === "paid" && invoice.credit_total > 0 && invoice.amount_paid <= 0.005) return "Credited";
  return financeInvoiceStatusLabels[invoice.status];
}
