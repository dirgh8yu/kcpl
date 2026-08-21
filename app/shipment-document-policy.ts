import type { KcplStaffRole } from "./admin/staff-permissions";
import type { ShipmentDocumentEffectiveStatus, ShipmentDocumentReviewStatus } from "./shipment-document-types";

const reviewStatuses = ["received", "under_review", "verified", "rejected", "superseded", "deleted"] as const satisfies readonly ShipmentDocumentReviewStatus[];

export const shipmentDocumentVisibilities = ["internal", "customer_safe"] as const;
export type ShipmentDocumentVisibility = (typeof shipmentDocumentVisibilities)[number];

export function shipmentDocumentReviewStatusValue(value: unknown): ShipmentDocumentReviewStatus {
  return reviewStatuses.includes(value as ShipmentDocumentReviewStatus)
    ? value as ShipmentDocumentReviewStatus
    : "received";
}

export function validDateOnly(value: string) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function effectiveShipmentDocumentStatus(input: {
  status: unknown;
  expiresOn?: string | null;
  today: string;
}): ShipmentDocumentEffectiveStatus {
  const status = shipmentDocumentReviewStatusValue(input.status);
  if (status === "verified" && input.expiresOn && validDateOnly(input.expiresOn) && input.expiresOn < input.today) return "expired";
  return status;
}

export function shipmentDocumentCountsAsReady(input: {
  status: unknown;
  expiresOn?: string | null;
  today: string;
}) {
  return effectiveShipmentDocumentStatus(input) === "verified";
}

export function canReviewShipmentDocuments(role: KcplStaffRole) {
  return role === "management" || role === "operations";
}

export function canDeleteShipmentDocument(input: {
  role: KcplStaffRole;
  actorEmail: string;
  uploadedByEmail?: string | null;
  status: unknown;
}) {
  if (input.role === "management") return true;
  const status = shipmentDocumentReviewStatusValue(input.status);
  return Boolean(
    input.role === "operations"
    && status === "received"
    && input.actorEmail.trim().toLowerCase()
    && input.actorEmail.trim().toLowerCase() === (input.uploadedByEmail ?? "").trim().toLowerCase()
  );
}

export function canVerifyOwnShipmentDocument(input: { role: KcplStaffRole; actorEmail: string; uploadedByEmail?: string | null }) {
  if (input.role === "management") return true;
  return input.actorEmail.trim().toLowerCase() !== (input.uploadedByEmail ?? "").trim().toLowerCase();
}

export function shipmentDocumentTransitionError(input: {
  from: unknown;
  to: unknown;
  role: KcplStaffRole;
  actorEmail: string;
  uploadedByEmail?: string | null;
  reviewNote?: string;
  expiresOn?: string;
}) {
  const from = shipmentDocumentReviewStatusValue(input.from);
  const to = shipmentDocumentReviewStatusValue(input.to);
  if (!canReviewShipmentDocuments(input.role)) return "Only Operations or Management can review shipment documents.";
  if (["deleted", "superseded"].includes(from)) return "Deleted or superseded documents cannot be reviewed.";
  if (to === "deleted" || to === "superseded") return "Use the dedicated delete or supersede action for this document.";
  if (to === "verified" && !canVerifyOwnShipmentDocument(input)) return "A non-management user cannot verify a document they uploaded themselves.";
  if (to === "rejected" && (input.reviewNote ?? "").trim().length < 4) return "Add a short reason before rejecting a document.";
  if (input.expiresOn && !validDateOnly(input.expiresOn)) return "Choose a real document expiry date.";
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function validateShipmentDocumentBytes(extension: string, data: Uint8Array) {
  const ext = extension.toLowerCase();
  if (!data.length) return "The selected file is empty.";
  if (ext === "pdf" && !ascii(data, 0, 5).startsWith("%PDF-")) return "The file extension says PDF, but the file content is not a PDF.";
  if (["jpg", "jpeg"].includes(ext) && !startsWith(data, [0xff, 0xd8, 0xff])) return "The file extension says JPEG, but the file content is not a JPEG image.";
  if (ext === "png" && !startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "The file extension says PNG, but the file content is not a PNG image.";
  if (ext === "webp" && !(ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 4) === "WEBP")) return "The file extension says WEBP, but the file content is not a WEBP image.";
  if (["doc", "xls"].includes(ext) && !startsWith(data, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "The file extension does not match a legacy Microsoft Office file.";
  if (["docx", "xlsx"].includes(ext) && !(startsWith(data, [0x50, 0x4b, 0x03, 0x04]) || startsWith(data, [0x50, 0x4b, 0x05, 0x06]) || startsWith(data, [0x50, 0x4b, 0x07, 0x08]))) return "The file extension does not match an Office Open XML file.";
  if (["csv", "txt"].includes(ext)) {
    if (data.some((value) => value === 0)) return "Text and CSV documents cannot contain binary NUL bytes.";
    try { new TextDecoder("utf-8", { fatal: true }).decode(data); } catch { return "Text and CSV documents must contain valid UTF-8 text."; }
  }
  return null;
}
