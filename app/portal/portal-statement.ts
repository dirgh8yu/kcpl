import type { PortalInvoiceView } from "./portal-access-policy";

/*
 * A customer's statement of account: what is owed, how overdue, and what has
 * been paid. Pure: built from the invoices and payments the portal already
 * shows the customer, so the statement can never say more than the portal
 * does. Each currency stands alone; nothing is converted.
 */

export type StatementPayment = {
  invoice: string;
  date: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
};

export type StatementAgeing = { current: number; days1to30: number; days31to60: number; days61to90: number; over90: number };

export type StatementOpenInvoice = {
  invoice: string;
  issued: string;
  due: string;
  total: number;
  balance: number;
  daysOverdue: number;
};

export type StatementCurrency = {
  currency: string;
  /** Issued in the statement period. */
  invoiced: number;
  /** Received in the statement period. */
  received: number;
  /** Owed now, and the part of it past due. */
  outstanding: number;
  overdue: number;
  ageing: StatementAgeing;
  open: StatementOpenInvoice[];
  payments: StatementPayment[];
};

export type Statement = {
  asOf: string;
  since: string;
  currencies: StatementCurrency[];
};

/** The period a statement covers by default: the last twelve months. */
export const STATEMENT_MONTHS = 12;

const round = (value: number) => Math.round(value * 100) / 100;

function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
}

export function statementSince(asOf: string, months = STATEMENT_MONTHS) {
  const date = new Date(`${asOf.slice(0, 10)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

/** Invoices only: credit notes and drafts never age or appear as owed. */
function counts(invoice: PortalInvoiceView) {
  return invoice.record_type === "invoice" && !["draft", "void", "cancelled"].includes(invoice.status);
}

export function buildStatement(input: { invoices: PortalInvoiceView[]; payments: StatementPayment[]; asOf: string; since?: string }): Statement {
  const asOf = input.asOf.slice(0, 10);
  const since = (input.since ?? statementSince(asOf)).slice(0, 10);
  const byCurrency = new Map<string, StatementCurrency>();
  const bucket = (currency: string) => {
    let entry = byCurrency.get(currency);
    if (!entry) {
      entry = {
        currency,
        invoiced: 0,
        received: 0,
        outstanding: 0,
        overdue: 0,
        ageing: { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 },
        open: [],
        payments: [],
      };
      byCurrency.set(currency, entry);
    }
    return entry;
  };

  for (const invoice of input.invoices.filter(counts)) {
    const entry = bucket(invoice.currency || "NPR");
    if (invoice.issue_date.slice(0, 10) >= since && invoice.issue_date.slice(0, 10) <= asOf) entry.invoiced += invoice.total;
    const balance = invoice.balance_due;
    if (balance <= 0.004) continue;
    const late = invoice.due_date ? Math.max(0, daysBetween(invoice.due_date, asOf)) : 0;
    entry.outstanding += balance;
    if (late > 0) entry.overdue += balance;
    const ageing = entry.ageing;
    if (late <= 0) ageing.current += balance;
    else if (late <= 30) ageing.days1to30 += balance;
    else if (late <= 60) ageing.days31to60 += balance;
    else if (late <= 90) ageing.days61to90 += balance;
    else ageing.over90 += balance;
    entry.open.push({
      invoice: invoice.external_invoice_number || invoice.reference,
      issued: invoice.issue_date,
      due: invoice.due_date,
      total: invoice.total,
      balance,
      daysOverdue: late,
    });
  }

  for (const payment of input.payments) {
    const date = payment.date.slice(0, 10);
    if (date < since || date > asOf) continue;
    const entry = bucket(payment.currency || "NPR");
    entry.received += payment.amount;
    entry.payments.push(payment);
  }

  const currencies = [...byCurrency.values()].map((entry) => ({
    ...entry,
    invoiced: round(entry.invoiced),
    received: round(entry.received),
    outstanding: round(entry.outstanding),
    overdue: round(entry.overdue),
    ageing: Object.fromEntries(Object.entries(entry.ageing).map(([key, value]) => [key, round(value)])) as StatementAgeing,
    // Oldest debt first; newest payment first.
    open: entry.open.sort((a, b) => b.daysOverdue - a.daysOverdue || a.due.localeCompare(b.due)),
    payments: entry.payments.sort((a, b) => b.date.localeCompare(a.date)),
  }));
  // Rupees first, then by what is owed.
  currencies.sort((a, b) => Number(b.currency === "NPR") - Number(a.currency === "NPR") || b.outstanding - a.outstanding);
  return { asOf, since, currencies };
}
