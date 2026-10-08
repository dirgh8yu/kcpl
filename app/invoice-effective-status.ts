/*
 * One reading of an invoice's status, for staff and customers alike.
 *
 * The stored status only changes when someone writes to the invoice, so an
 * issued invoice whose due date passes overnight still says "issued". Admin
 * finance and the customer portal both derive the status the same way from
 * the due date and balance, on Nepal's calendar, so the two never disagree
 * about what is overdue.
 */

/** Today's date in Kathmandu as YYYY-MM-DD: KCPL's operational day. */
export function nepalOperationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Drafts, voids and settled invoices keep their status. Otherwise a cleared
 * balance is paid, a passed due date is overdue, and an invoice stored as
 * overdue whose due date moved later is issued again.
 */
export function effectiveInvoiceStatus<S extends string>(status: S, dueDate: string, balanceDue: number, today: string): S | "paid" | "overdue" | "issued" {
  if (status === "draft" || status === "void" || status === "paid") return status;
  if (balanceDue <= 0.00001) return "paid";
  if (dueDate && dueDate.slice(0, 10) < today) return "overdue";
  return status === "overdue" ? "issued" : status;
}

function dayNumber(day: string) {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/**
 * The dates an invoice carries when it is issued. A draft keeps the dates it
 * was written with, so one drafted on the 1st with 15-day terms and issued on
 * the 20th used to go out already overdue. Issued later than drafted, it is
 * dated the day it is issued and keeps the same number of days to pay.
 */
export function invoiceDatesOnIssue(issueDate: string, dueDate: string, today: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
  if (!valid(issueDate) || !valid(today) || issueDate >= today) return { issueDate, dueDate, moved: false };
  const termDays = valid(dueDate) ? Math.max(0, dayNumber(dueDate) - dayNumber(issueDate)) : 0;
  const due = new Date((dayNumber(today) + termDays) * 86_400_000).toISOString().slice(0, 10);
  return { issueDate: today, dueDate: due, moved: true };
}
