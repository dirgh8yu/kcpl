import type { RefundStatus } from "../refund-policy";

export function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

export function refundTone(status: RefundStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "requested") return "warning";
  if (status === "approved") return "info";
  if (status === "paid") return "success";
  if (status === "rejected") return "danger";
  return "neutral";
}

/** Several currencies are never added together; each is shown on its own. */
export function totalsByCurrency(rows: Array<{ currency: string; amount: number }>) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amount);
  return [...totals.entries()].map(([currency, amount]) => money(amount, currency)).join(" · ");
}
