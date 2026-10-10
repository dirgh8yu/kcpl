/*
 * VAT books for a Nepali month: the sales book (invoices issued, less credit
 * notes) and the purchase book (supplier bills), laid out the way they are
 * kept for the VAT return, and the figures the return needs.
 *
 * Pure: built from the stored invoice, credit note and bill data. Amounts
 * stay in each document's currency; the return is in rupees, so a document in
 * another currency is listed and flagged, never silently converted.
 */

import { bsDateNumeric } from "../../nepali-calendar.ts";
import { csvRow } from "../management/csv-export-policy.ts";

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function str(value: unknown) {
  return typeof value === "string" ? value : "";
}
function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type SalesBookRow = {
  kind: "invoice" | "credit_note" | "void";
  date: string;
  date_bs: string;
  number: string;
  /** For a credit note, the invoice it corrects. */
  against: string | null;
  customer_name: string;
  customer_pan: string | null;
  currency: string;
  /** KCPL's charges before VAT; money paid on the customer's behalf is not a sale. */
  total_sales: number;
  non_taxable: number;
  taxable: number;
  vat: number;
  paid_on_behalf: number;
  reference: string;
};

export type PurchaseBookRow = {
  date: string;
  date_bs: string;
  bill_number: string;
  supplier_name: string;
  supplier_pan: string | null;
  currency: string;
  total_purchase: number;
  non_taxable: number;
  taxable: number;
  vat: number;
  reference: string;
  /** Dated in an earlier month that was already filed; counted in this one. */
  booked_late: boolean;
};

type Lines = Array<{ kind?: unknown; tax_rate?: unknown; subtotal?: unknown }>;

/** An invoice's own charges split into taxable and not, from its lines. */
function serviceSplit(lines: Lines) {
  let taxable = 0;
  let nonTaxable = 0;
  for (const line of lines) {
    if (line.kind === "disbursement") continue;
    if (num(line.tax_rate) > 0) taxable += num(line.subtotal);
    else nonTaxable += num(line.subtotal);
  }
  return { taxable: round(taxable), nonTaxable: round(nonTaxable) };
}

export function salesBookInvoiceRow(reference: string, data: Record<string, unknown>): SalesBookRow | null {
  const number = str(data.tax_invoice_number);
  const date = str(data.issue_date);
  if (!number || !date) return null;
  const voided = str(data.status) === "void";
  const lines = Array.isArray(data.line_items) ? data.line_items as Lines : [];
  const split = serviceSplit(lines);
  const disbursement = num(data.disbursement_total);
  return {
    kind: voided ? "void" : "invoice",
    date,
    date_bs: bsDateNumeric(date),
    number,
    against: null,
    customer_name: str(data.customer_name) || "Customer",
    customer_pan: str(data.customer_tax_id) || null,
    currency: str(data.currency) || "NPR",
    // A void invoice keeps its line in the book, at nothing, so the numbers run without a gap.
    total_sales: voided ? 0 : round(split.taxable + split.nonTaxable),
    non_taxable: voided ? 0 : split.nonTaxable,
    taxable: voided ? 0 : split.taxable,
    vat: voided ? 0 : round(num(data.tax_total)),
    paid_on_behalf: voided ? 0 : round(disbursement),
    reference,
  };
}

/**
 * A credit note as a sales return: negative. Its charge (what is left after
 * the VAT and the at-cost part) is split between taxable and not in the same
 * proportions as the invoice's own charges.
 */
export function salesBookCreditRow(invoiceReference: string, invoice: Record<string, unknown>, note: Record<string, unknown>): SalesBookRow | null {
  const number = str(note.number);
  const date = str(note.credit_date);
  if (!number || !date) return null;
  const amount = num(note.amount);
  const vat = num(note.tax_amount);
  const atCost = num(note.disbursement_amount);
  const charge = round(amount - vat - atCost);
  const lines = Array.isArray(invoice.line_items) ? invoice.line_items as Lines : [];
  const split = serviceSplit(lines);
  const base = split.taxable + split.nonTaxable;
  const taxable = base > 0 ? round((charge * split.taxable) / base) : (vat > 0 ? charge : 0);
  return {
    kind: "credit_note",
    date,
    date_bs: bsDateNumeric(date),
    number,
    against: str(invoice.tax_invoice_number) || invoiceReference,
    customer_name: str(invoice.customer_name) || "Customer",
    customer_pan: str(invoice.customer_tax_id) || null,
    currency: str(invoice.currency) || "NPR",
    total_sales: -charge,
    non_taxable: -round(charge - taxable),
    taxable: -taxable,
    vat: -round(vat),
    paid_on_behalf: -round(atCost),
    reference: invoiceReference,
  };
}

export function purchaseBookRow(reference: string, data: Record<string, unknown>, supplierPan: string | null): PurchaseBookRow | null {
  const status = str(data.status);
  if (status === "draft" || status === "void" || str(data.record_type) === "opening_balance") return null;
  const date = str(data.bill_date);
  if (!date) return null;
  const subtotal = num(data.subtotal);
  const vat = num(data.tax_total);
  const taxed = vat > 0 || num(data.tax_rate) > 0;
  return {
    date,
    date_bs: bsDateNumeric(date),
    bill_number: str(data.supplier_bill_reference) || reference,
    supplier_name: str(data.supplier_name) || "Supplier",
    supplier_pan: supplierPan,
    currency: str(data.currency) || "NPR",
    total_purchase: round(subtotal),
    non_taxable: taxed ? 0 : round(subtotal),
    taxable: taxed ? round(subtotal) : 0,
    vat: round(vat),
    reference,
    booked_late: Boolean(str(data.vat_booked_on)),
  };
}

export type VatSummary = {
  /** Rupee documents only: the return is in rupees. */
  output_vat: number;
  input_vat: number;
  /** Positive is owed to the tax office; negative carries forward. */
  net_vat: number;
  taxable_sales: number;
  non_taxable_sales: number;
  taxable_purchases: number;
  /** Documents in another currency, left out of the figures above until converted. */
  foreign_sales: number;
  foreign_purchases: number;
  missing_customer_pan: number;
};

export function vatSummary(sales: SalesBookRow[], purchases: PurchaseBookRow[]): VatSummary {
  const npr = (currency: string) => currency.toUpperCase() === "NPR";
  const sum = <T,>(rows: T[], pick: (row: T) => number) => round(rows.reduce((total, row) => total + pick(row), 0));
  const nprSales = sales.filter((row) => npr(row.currency));
  const nprPurchases = purchases.filter((row) => npr(row.currency));
  const output = sum(nprSales, (row) => row.vat);
  const input = sum(nprPurchases, (row) => row.vat);
  return {
    output_vat: output,
    input_vat: input,
    net_vat: round(output - input),
    taxable_sales: sum(nprSales, (row) => row.taxable),
    non_taxable_sales: sum(nprSales, (row) => row.non_taxable),
    taxable_purchases: sum(nprPurchases, (row) => row.taxable),
    foreign_sales: sales.filter((row) => !npr(row.currency) && row.kind !== "void").length,
    foreign_purchases: purchases.filter((row) => !npr(row.currency)).length,
    missing_customer_pan: sales.filter((row) => row.kind === "invoice" && row.taxable > 0 && !row.customer_pan).length,
  };
}

export function sortBookRows<T extends { date: string; number?: string; bill_number?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || (a.number ?? a.bill_number ?? "").localeCompare(b.number ?? b.bill_number ?? ""));
}

export function salesBookCsv(rows: SalesBookRow[]) {
  const head = ["Date (BS)", "Date (AD)", "Invoice / credit note no.", "Against invoice", "Customer", "Customer PAN", "Currency", "Total sales", "Non-taxable sales", "Taxable sales", "VAT", "Paid on behalf (not sales)", "Note"];
  return [csvRow(head), ...rows.map((row) => csvRow([
    row.date_bs, row.date, row.number, row.against ?? "", row.customer_name, row.customer_pan ?? "", row.currency,
    row.total_sales, row.non_taxable, row.taxable, row.vat, row.paid_on_behalf,
    row.kind === "void" ? "Void" : row.kind === "credit_note" ? "Sales return (credit note)" : "",
  ]))].join("\r\n") + "\r\n";
}

export function purchaseBookCsv(rows: PurchaseBookRow[]) {
  const head = ["Date (BS)", "Date (AD)", "Supplier bill no.", "Supplier", "Supplier PAN", "Currency", "Total purchases", "Non-taxable purchases", "Taxable purchases", "VAT", "Note"];
  return [csvRow(head), ...rows.map((row) => csvRow([
    row.date_bs, row.date, row.bill_number, row.supplier_name, row.supplier_pan ?? "", row.currency,
    row.total_purchase, row.non_taxable, row.taxable, row.vat,
    row.booked_late ? "Received after its month was filed" : "",
  ]))].join("\r\n") + "\r\n";
}
