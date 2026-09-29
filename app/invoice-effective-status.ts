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
