/*
 * The next thirteen weeks of money in and out, by week and currency: what
 * customers owe by the date it's due, what KCPL owes suppliers, refunds
 * approved, TDS to deposit and VAT to pay. Pure: the server gathers the open documents;
 * this puts them in weeks and keeps the running balance.
 *
 * Overdue money owed to KCPL is shown but not counted in the balance, since
 * nobody knows when it will come. Overdue money KCPL owes is counted now.
 */

export type CashFlowKind = "invoice" | "bill" | "refund" | "tds" | "vat";

export type CashFlowEntry = {
  kind: CashFlowKind;
  direction: "in" | "out";
  currency: string;
  amount: number;
  /** When it's due, YYYY-MM-DD. Null is due now (an approved refund). */
  date: string | null;
  label: string;
  link: string | null;
};

export type CashFlowWeek = { start: string; end: string };

export type CashFlowRow = {
  in: number;
  out: number;
  net: number;
  /** The bank balance after this row, when the opening balance is known. */
  balance: number | null;
  count: number;
};

export type CashFlowCurrency = {
  currency: string;
  opening: number | null;
  overdue: CashFlowRow & { in_overdue: number };
  weeks: Array<CashFlowWeek & CashFlowRow>;
  later: CashFlowRow;
  /** The first week the balance goes below zero, if it does. */
  short_from: string | null;
  lowest: number | null;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Weeks from Sunday to Saturday, Nepal's working week, starting with the one today is in. */
export function cashFlowWeeks(today: string, count = 13): CashFlowWeek[] {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  const first = addDays(today, -day);
  return Array.from({ length: count }, (_, index) => ({ start: addDays(first, index * 7), end: addDays(first, index * 7 + 6) }));
}

function emptyRow(): CashFlowRow { return { in: 0, out: 0, net: 0, balance: null, count: 0 }; }

function add(row: CashFlowRow, entry: CashFlowEntry) {
  if (entry.direction === "in") row.in = round(row.in + entry.amount);
  else row.out = round(row.out + entry.amount);
  row.net = round(row.in - row.out);
  row.count += 1;
}

export function cashFlowByCurrency(entries: CashFlowEntry[], today: string, openings: Array<{ currency: string; balance: number }>, count = 13): CashFlowCurrency[] {
  const weeks = cashFlowWeeks(today, count);
  const lastDay = weeks[weeks.length - 1].end;
  const currencies = [...new Set([...entries.filter((entry) => entry.amount > 0).map((entry) => entry.currency), ...openings.map((item) => item.currency)])]
    .sort((a, b) => (a === "NPR" ? -1 : b === "NPR" ? 1 : a.localeCompare(b)));
  return currencies.map((currency) => {
    const opened = openings.filter((item) => item.currency === currency);
    const opening = opened.length ? round(opened.reduce((sum, item) => sum + item.balance, 0)) : null;
    const overdue = { ...emptyRow(), in_overdue: 0 };
    const rows = weeks.map((week) => ({ ...week, ...emptyRow() }));
    const later = emptyRow();
    for (const entry of entries) {
      if (entry.currency !== currency || !(entry.amount > 0)) continue;
      const date = entry.date ?? today;
      if (date < today) {
        if (entry.direction === "in") { overdue.in_overdue = round(overdue.in_overdue + entry.amount); overdue.count += 1; }
        else add(overdue, entry);
      } else if (date > lastDay) add(later, entry);
      else add(rows.find((week) => date >= week.start && date <= week.end) ?? rows[0], entry);
    }
    // Overdue money in is listed, not counted: the row's in stays 0. The
    // balance runs through the overdue row and the weeks; the row after the
    // thirteenth week doesn't count towards the lowest point.
    let balance = opening;
    let shortFrom: string | null = null;
    let lowest: number | null = null;
    for (const [row, start] of [[overdue, today], ...rows.map((week) => [week, week.start] as const)] as Array<readonly [CashFlowRow, string]>) {
      if (balance === null) break;
      balance = round(balance + row.net);
      row.balance = balance;
      if (lowest === null || balance < lowest) lowest = balance;
      if (balance < 0 && !shortFrom) shortFrom = start;
    }
    if (balance !== null) later.balance = round(balance + later.net);
    return { currency, opening, overdue, weeks: rows, later, short_from: shortFrom, lowest };
  });
}
