/*
 * Pure rules for KCPL Ops field work, kept free of server imports so they can
 * be tested directly.
 */

import { shipmentDocumentTypes, type ShipmentDocumentType } from "../shipment-document-types.ts";

export const OPS_FIELD_NOTE_MAX = 2000;
export const OPS_FIELD_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** A photo taken on a phone: images and PDFs from the document scanner only.
 * The staff vault's Word and Excel types are desk work, not field work. */
export const opsFieldPhotoExtensions: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** Filed as "other" unless the staff member says what it is. */
export function opsFieldDocumentType(value: unknown): ShipmentDocumentType | null {
  if (value === null || value === undefined || String(value).trim() === "") return "other";
  const text = String(value).trim();
  return shipmentDocumentTypes.includes(text as ShipmentDocumentType) ? (text as ShipmentDocumentType) : null;
}

/**
 * The comparable form of a scanned or typed identifier: letters and digits
 * only, upper case. A container number painted as "MSCU 123456-7", printed as
 * "MSCU1234567" in a barcode and typed as "mscu1234567" is one number.
 */
export function opsLookupKey(value: unknown) {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 64) : "";
}

/** Too short to identify anything: two letters would match half the fleet. */
export function opsLookupUsable(key: string) {
  return key.length >= 4;
}

/**
 * How well a shipment's identifiers answer a scanned key: 0 is no match.
 * Exact beats contained, and the job's own reference beats a carrier's.
 */
export function opsLookupScore(key: string, identifiers: { reference: string; carrierReference?: unknown; internalReference?: unknown }) {
  const fields: Array<[string, number]> = [
    [opsLookupKey(identifiers.reference), 3],
    [opsLookupKey(identifiers.carrierReference), 2],
    [opsLookupKey(identifiers.internalReference), 2],
  ];
  let best = 0;
  for (const [field, weight] of fields) {
    if (!field) continue;
    if (field === key) best = Math.max(best, weight * 10);
    else if (key.length >= 6 && (field.includes(key) || key.includes(field))) best = Math.max(best, weight);
  }
  return best;
}
