import { shipmentStatusLabels, type ShipmentStatus } from "../shipment-types.ts";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../shipment-document-types.ts";
import { portalText, type PortalLocale, type PortalTextKey } from "./portal-i18n.ts";

/*
 * Labels take a locale and default to English, so a caller that has no reader
 * -- a staff surface, a log line -- keeps the English it always had, and every
 * customer-facing caller opts in by passing the session's language.
 */

function labelled(locale: PortalLocale, key: string, fallback: string) {
  const dictionaryKey = key as PortalTextKey;
  const translated = portalText(locale, dictionaryKey);
  // An unknown key comes back as itself; fall back to the English label rather
  // than printing a dictionary key at a customer.
  return translated === key ? fallback : translated;
}

export const portalModeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  road: "Road freight",
  unsure: "Freight movement",
};

export type PortalTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "violet";

const statusTones: Record<string, PortalTone> = {
  booking_confirmed: "info",
  preparing: "neutral",
  in_transit: "accent",
  customs_clearance: "violet",
  out_for_delivery: "info",
  delivered: "success",
  exception: "danger",
};

export function portalStatusLabel(status: string, locale: PortalLocale = "en") {
  const fallback = shipmentStatusLabels[status as ShipmentStatus] ?? "Shipment update";
  if (locale === "en") return fallback;
  return labelled(locale, `status.${status}`, fallback);
}

export function portalStatusTone(status: string): PortalTone {
  return statusTones[status] ?? "neutral";
}

export function portalModeLabel(mode: string, locale: PortalLocale = "en") {
  const fallback = portalModeLabels[mode] ?? portalModeLabels.unsure;
  if (locale === "en") return fallback;
  return labelled(locale, `mode.${mode}`, labelled(locale, "mode.unsure", fallback));
}

export function portalDocumentLabel(documentType: string, locale: PortalLocale = "en") {
  const fallback = shipmentDocumentTypeLabels[documentType as ShipmentDocumentType] ?? "Document";
  if (locale === "en") return fallback;
  return labelled(locale, `doc.${documentType}`, labelled(locale, "doc.unknown", fallback));
}

const invoiceStatusTones: Record<string, PortalTone> = {
  issued: "info",
  partially_paid: "warning",
  paid: "success",
  overdue: "danger",
};

export function portalInvoiceTone(status: string): PortalTone {
  return invoiceStatusTones[status] ?? "neutral";
}

export const portalInvoiceStatusLabels: Record<string, string> = {
  issued: "Issued",
  partially_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
};

export function portalInvoiceStatusLabel(status: string, locale: PortalLocale = "en") {
  const fallback = portalInvoiceStatusLabels[status] ?? "Open";
  if (locale === "en") return fallback;
  return labelled(locale, `invoice.${status}`, labelled(locale, "invoice.open", fallback));
}

/** Nepal runs UTC+05:45; portal timestamps are shown in KCPL's own working day.
 *
 * Deliberately Gregorian in both languages, with Latin digits. Nepal keeps
 * Bikram Sambat for domestic life, but every carrier document, customs entry
 * and invoice this portal reports on is dated Gregorian -- a portal that
 * converted would stop matching the paperwork in the reader's hand. */
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kathmandu",
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Kathmandu",
});

export function portalDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormat.format(parsed);
}

export function portalDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormat.format(parsed);
}

export function portalMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function portalFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
