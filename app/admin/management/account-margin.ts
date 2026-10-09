/*
 * Margin and commission by account manager, for a period.
 *
 * Revenue is each invoice issued in the period, at what KCPL earns on it
 * (before VAT, less what it paid out for the customer at cost). Cost is the
 * shipment's job costs, shared across the shipment's invoices by revenue, so
 * a shipment invoiced in two months doesn't carry its whole cost twice.
 * Everything is in rupees at the rates handed in. Commission is a rate on the
 * positive margin, optionally only on what the customer has paid.
 *
 * Pure: the server gathers the records; this does the arithmetic.
 */

import { bsMonthNames, bsMonthRange } from "../../nepali-calendar.ts";

export type CommissionSettings = {
  /** Percent of margin. */
  default_rate: number;
  /** Per account manager (by staff uid), percent of margin. */
  rates: Record<string, number>;
  /** Count commission only on the paid share of each invoice. */
  paid_only: boolean;
};

export const defaultCommissionSettings: CommissionSettings = { default_rate: 0, rates: {}, paid_only: true };

export type MarginInvoice = {
  reference: string;
  number: string;
  customer_id: string | null;
  customer_name: string;
  shipment_reference: string | null;
  /** Rupees KCPL earns on the invoice. */
  revenue_npr: number;
  /** Share of the invoice the customer has paid, 0 to 1. */
  paid_share: number;
};

export type ManagerRef = { uid: string | null; name: string };

export type ManagerMarginRow = {
  uid: string | null;
  name: string;
  invoices: number;
  customers: number;
  revenue: number;
  cost: number;
  margin: number;
  margin_percent: number | null;
  commission_rate: number;
  commission_base: number;
  commission: number;
  top_customers: Array<{ customer_id: string | null; name: string; revenue: number; margin: number }>;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** A Nepali month, or a fiscal year from 1 Shrawan to the end of Ashadh. */
export type MarginPeriod = { kind: "month" | "fiscal"; year: number; month: number; start: string; end: string; label: string };

export function marginPeriod(input: { fy?: string | null; y?: string | null; m?: string | null }, current: { year: number; month: number }): MarginPeriod | null {
  if (input.fy) {
    const year = Number(input.fy);
    const first = Number.isInteger(year) ? bsMonthRange(year, 4) : null;
    const last = Number.isInteger(year) ? bsMonthRange(year + 1, 3) : null;
    return first && last ? { kind: "fiscal", year, month: 4, start: first.start, end: last.end, label: `Fiscal year ${year}/${String((year + 1) % 100).padStart(2, "0")}` } : null;
  }
  const year = input.y ? Number(input.y) : current.year;
  const month = input.m ? Number(input.m) : current.month;
  const range = Number.isInteger(year) && Number.isInteger(month) ? bsMonthRange(year, month) : null;
  return range ? { kind: "month", year, month, start: range.start, end: range.end, label: `${bsMonthNames[month - 1]} ${year}` } : null;
}

/** The fiscal year (by its first BS year) a BS month falls in. */
export function fiscalYearOf(year: number, month: number) {
  return month >= 4 ? year : year - 1;
}

export function commissionSettingsFrom(raw: unknown): CommissionSettings {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  const rates: Record<string, number> = {};
  if (data.rates && typeof data.rates === "object") {
    for (const [uid, value] of Object.entries(data.rates as Record<string, unknown>)) {
      const parsed = rate(value);
      if (parsed !== null && uid) rates[uid] = parsed;
    }
  }
  return { default_rate: rate(data.default_rate) ?? 0, rates, paid_only: data.paid_only !== false };
}

/** Settings as Management entered them, checked. Errors are sentences for them. */
export function commissionSettingsFromInput(raw: Record<string, unknown>): { ok: true; settings: CommissionSettings } | { ok: false; error: string } {
  const rate = (value: unknown) => {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.round(parsed * 100) / 100 : null;
  };
  const defaultRate = raw.defaultRate === undefined || raw.defaultRate === "" ? 0 : rate(raw.defaultRate);
  if (defaultRate === null) return { ok: false, error: "The usual rate must be between 0 and 100%." };
  const rates: Record<string, number> = {};
  const entries = raw.rates && typeof raw.rates === "object" ? Object.entries(raw.rates as Record<string, unknown>) : [];
  if (entries.length > 200) return { ok: false, error: "Too many rates at once." };
  for (const [uid, value] of entries) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return { ok: false, error: "A rate was for someone who isn't on the list." };
    if (value === "" || value === null || value === undefined) continue;
    const parsed = rate(value);
    if (parsed === null) return { ok: false, error: "Each rate must be between 0 and 100%." };
    rates[uid] = parsed;
  }
  return { ok: true, settings: { default_rate: defaultRate, rates, paid_only: raw.paidOnly !== false } };
}

/** Share of an invoice the customer has settled (paid, credit applied or tax withheld), 0 to 1. */
export function invoicePaidShare(total: number, balanceDue: number) {
  if (!(total > 0)) return 1;
  return Math.max(0, Math.min(1, (total - Math.max(0, balanceDue)) / total));
}

/**
 * Each invoice's share of its shipment's cost: cost × invoice revenue ÷ the
 * shipment's revenue over all its invoices. An invoice with no shipment, or a
 * shipment with no revenue, carries no cost.
 */
export function invoiceCostShare(invoiceRevenue: number, shipmentRevenue: number, shipmentCost: number) {
  if (!(shipmentRevenue > 0) || !(invoiceRevenue > 0)) return 0;
  return round(shipmentCost * Math.min(1, invoiceRevenue / shipmentRevenue));
}

export function managerMargins(input: {
  invoices: MarginInvoice[];
  /** Rupees of counted job costs per shipment, over its whole life. */
  shipmentCost: Map<string, number>;
  /** Rupees of revenue per shipment, over all its invoices. */
  shipmentRevenue: Map<string, number>;
  /** The account manager of each customer. */
  managerOf: (customerId: string | null) => ManagerRef;
  settings: CommissionSettings;
}): ManagerMarginRow[] {
  type Mutable = ManagerMarginRow & { customerSet: Map<string, { customer_id: string | null; name: string; revenue: number; margin: number }> };
  const rows = new Map<string, Mutable>();
  for (const invoice of input.invoices) {
    const manager = input.managerOf(invoice.customer_id);
    const key = manager.uid ?? "unassigned";
    let row = rows.get(key);
    if (!row) {
      const rate = manager.uid ? input.settings.rates[manager.uid] ?? input.settings.default_rate : 0;
      row = { uid: manager.uid, name: manager.name, invoices: 0, customers: 0, revenue: 0, cost: 0, margin: 0, margin_percent: null, commission_rate: rate, commission_base: 0, commission: 0, top_customers: [], customerSet: new Map() };
      rows.set(key, row);
    }
    const cost = invoice.shipment_reference ? invoiceCostShare(invoice.revenue_npr, input.shipmentRevenue.get(invoice.shipment_reference) ?? 0, input.shipmentCost.get(invoice.shipment_reference) ?? 0) : 0;
    const margin = round(invoice.revenue_npr - cost);
    row.invoices += 1;
    row.revenue = round(row.revenue + invoice.revenue_npr);
    row.cost = round(row.cost + cost);
    row.margin = round(row.margin + margin);
    // Commission is earned on margin, never charged back on a loss, and on the paid share when set.
    const base = Math.max(0, margin) * (input.settings.paid_only ? Math.max(0, Math.min(1, invoice.paid_share)) : 1);
    row.commission_base = round(row.commission_base + base);
    const customerKey = invoice.customer_id ?? invoice.customer_name;
    const customer = row.customerSet.get(customerKey) ?? { customer_id: invoice.customer_id, name: invoice.customer_name, revenue: 0, margin: 0 };
    customer.revenue = round(customer.revenue + invoice.revenue_npr);
    customer.margin = round(customer.margin + margin);
    row.customerSet.set(customerKey, customer);
  }
  return [...rows.values()].map(({ customerSet, ...row }) => ({
    ...row,
    customers: customerSet.size,
    margin_percent: row.revenue > 0 ? Math.round((row.margin / row.revenue) * 10000) / 100 : null,
    commission: round(row.commission_base * row.commission_rate / 100),
    top_customers: [...customerSet.values()].sort((a, b) => b.margin - a.margin).slice(0, 5),
  })).sort((a, b) => (a.uid === null ? 1 : 0) - (b.uid === null ? 1 : 0) || b.margin - a.margin);
}
