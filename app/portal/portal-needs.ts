import type { FreeTimeStatus } from "../shipment-free-time";
import type { PortalQuoteView, PortalRequirementRow } from "./portal-access-policy";

// "What KCPL needs from you": everything a customer has to do, in one list at
// the top of their portal, most pressing first. Each item is one thing to do
// with one button, so a customer who signs in for a reason finds it at once.

export type PortalNeed =
  | { kind: "documents"; reference: string; route: string; documentTypes: string[]; href: string }
  | { kind: "pay_overdue"; count: number; href: string }
  | { kind: "free_time"; reference: string; route: string; location: string | null; status: FreeTimeStatus; href: string }
  | { kind: "quote"; reference: string; route: string; amount: number | null; currency: string; validUntil: string | null; href: string }
  | { kind: "pay_open"; count: number; href: string };

export type PortalNeedsInput = {
  outstanding: { reference: string; origin: string; destination: string; rows: Pick<PortalRequirementRow, "document_type">[] }[];
  freeTime: { reference: string; origin: string; destination: string; location: string | null; status: FreeTimeStatus }[];
  quotesAwaiting: Pick<PortalQuoteView, "reference" | "origin" | "destination" | "quoted_amount" | "quote_currency" | "valid_until">[];
  finance: { openInvoices: number; overdueInvoices: number } | null;
};

function route(origin: string, destination: string) {
  return origin || destination ? `${origin || "—"} → ${destination || "—"}` : "";
}

export function portalNeeds(input: PortalNeedsInput): PortalNeed[] {
  const needs: PortalNeed[] = [];
  const shipment = (reference: string) => `/portal/shipments/${encodeURIComponent(reference)}`;
  for (const entry of input.outstanding) {
    if (!entry.rows.length) continue;
    needs.push({ kind: "documents", reference: entry.reference, route: route(entry.origin, entry.destination), documentTypes: entry.rows.map((row) => row.document_type), href: `${shipment(entry.reference)}#documents` });
  }
  const overdue = input.finance?.overdueInvoices ?? 0;
  if (overdue > 0) needs.push({ kind: "pay_overdue", count: overdue, href: "/portal/invoices" });
  // A clock that has run out, or runs out today, is costing money now; one
  // with days left comes after the things only the customer can unblock.
  const pressing = (row: PortalNeedsInput["freeTime"][number]) => row.status.state === "expired" || row.status.state === "last_day";
  const expired = input.freeTime.filter(pressing);
  const running = input.freeTime.filter((row) => !pressing(row));
  const freeTime = (row: PortalNeedsInput["freeTime"][number]): PortalNeed => ({ kind: "free_time", reference: row.reference, route: route(row.origin, row.destination), location: row.location, status: row.status, href: shipment(row.reference) });
  needs.push(...expired.map(freeTime));
  for (const quote of input.quotesAwaiting) {
    needs.push({ kind: "quote", reference: quote.reference, route: route(quote.origin, quote.destination), amount: quote.quoted_amount, currency: quote.quote_currency, validUntil: quote.valid_until, href: "/portal/requests" });
  }
  needs.push(...running.map(freeTime));
  const open = (input.finance?.openInvoices ?? 0) - overdue;
  if (open > 0) needs.push({ kind: "pay_open", count: open, href: "/portal/invoices" });
  return needs;
}
