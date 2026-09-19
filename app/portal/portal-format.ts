import { shipmentStatusLabels, type ShipmentStatus } from "../shipment-types.ts";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../shipment-document-types.ts";

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

export function portalStatusLabel(status: string) {
  return shipmentStatusLabels[status as ShipmentStatus] ?? "Shipment update";
}

export function portalStatusTone(status: string): PortalTone {
  return statusTones[status] ?? "neutral";
}

export function portalModeLabel(mode: string) {
  return portalModeLabels[mode] ?? portalModeLabels.unsure;
}

export function portalDocumentLabel(documentType: string) {
  return shipmentDocumentTypeLabels[documentType as ShipmentDocumentType] ?? "Document";
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

export function portalInvoiceStatusLabel(status: string) {
  return portalInvoiceStatusLabels[status] ?? "Open";
}

/** Nepal runs UTC+05:45; portal timestamps are shown in KCPL's own working day. */
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
