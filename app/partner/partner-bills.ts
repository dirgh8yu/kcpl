/*
 * A partner's invoice to KCPL, as they send it through the partner portal:
 * checked here before it becomes a draft supplier bill for Accounts.
 *
 * Pure.
 */

import { crmCurrencies } from "../admin/crm/crm-data.ts";
import type { PartnerShipmentRole } from "./partner-access-policy.ts";

/** The currencies KCPL keeps supplier bills in. */
export const PARTNER_BILL_CURRENCIES = crmCurrencies;
/** Nepal's VAT, or none for a bill from outside Nepal. */
export const PARTNER_BILL_VAT_RATES = [0, 13] as const;

/** The Job File cost category a partner's bill falls under, from their role on the shipment. */
export function partnerBillCategory(role: PartnerShipmentRole | null) {
  switch (role) {
    case "carrier": return "freight" as const;
    case "trucker": return "transport" as const;
    case "customs_agent": return "customs" as const;
    case "origin_agent":
    case "destination_agent": return "agent" as const;
    default: return "other" as const;
  }
}

export type PartnerBillInput = {
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  amount: number;
  vatRate: number;
  description: string;
};

export type PartnerBillError = "number" | "date" | "currency" | "amount" | "vat";

export function partnerBillFromInput(input: Record<string, unknown>, today: string): { ok: true; value: PartnerBillInput } | { ok: false; error: PartnerBillError } {
  const invoiceNumber = typeof input.invoiceNumber === "string" ? input.invoiceNumber.trim().slice(0, 80) : "";
  if (invoiceNumber.length < 1) return { ok: false, error: "number" };
  const invoiceDate = typeof input.invoiceDate === "string" ? input.invoiceDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || Number.isNaN(Date.parse(`${invoiceDate}T00:00:00Z`)) || invoiceDate > today) return { ok: false, error: "date" };
  const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
  if (!(PARTNER_BILL_CURRENCIES as readonly string[]).includes(currency)) return { ok: false, error: "currency" };
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return { ok: false, error: "amount" };
  const vatRate = Number(input.vatRate ?? 0);
  if (!(PARTNER_BILL_VAT_RATES as readonly number[]).includes(vatRate)) return { ok: false, error: "vat" };
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
  return { ok: true, value: { invoiceNumber, invoiceDate, currency, amount, vatRate, description } };
}

export function partnerBillTotal(input: Pick<PartnerBillInput, "amount" | "vatRate">) {
  const vat = Math.round(input.amount * (input.vatRate / 100) * 100) / 100;
  return { vat, total: Math.round((input.amount + vat) * 100) / 100 };
}

/** How a bill reads to the partner who sent it: nothing about KCPL's checks, only where it stands. */
export function partnerBillStatusLabel(status: string) {
  if (status === "draft") return "Received, being checked";
  if (status === "approved" || status === "overdue") return "Approved for payment";
  if (status === "partially_paid") return "Part paid";
  if (status === "paid") return "Paid";
  if (status === "void") return "Not accepted";
  return "Received";
}

/**
 * Whether what KCPL's reader found on the invoice agrees with what the
 * partner typed: the total and currency, and the number. Differences are
 * shown to Accounts, never to the partner.
 */
export function partnerBillReadingCheck(entered: { invoiceNumber: string; currency: string; total: number; amount: number }, read: { document_number: string | null; currency: string | null; invoice_total: number | null }) {
  const issues: string[] = [];
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (read.document_number && normalize(read.document_number) !== normalize(entered.invoiceNumber)) issues.push(`the invoice number reads ${read.document_number}`);
  if (read.currency && read.currency.toUpperCase() !== entered.currency) issues.push(`the currency reads ${read.currency.toUpperCase()}`);
  if (read.invoice_total !== null && Math.abs(read.invoice_total - entered.total) > 0.5 && Math.abs(read.invoice_total - entered.amount) > 0.5) issues.push(`the total reads ${read.invoice_total.toFixed(2)}`);
  return { matches: issues.length === 0, issues };
}
