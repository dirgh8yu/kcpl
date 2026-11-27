import { sanitizeQuoteAttribution } from "../../quote-attribution.ts";
import { quoteCorridor } from "../../quote-corridor.ts";

/*
 * The row the 90-day quote tracker expects, built from a stored quote document.
 *
 * The tracker is the measurement spine the sales desk fills in by hand, so the
 * column order here is the tracker's own and `docs/quote-tracker.csv` is its
 * template. The three lane columns sit next to origin/destination because that
 * is where a reader looks for the corridor: `lane_slug` is the KCPL lane key,
 * `lane_origin`/`lane_destination` are the English city names, and the localized
 * words the visitor typed stay in `origin`/`destination`.
 *
 * Columns the quote does not capture (incoterm, HS code, owner, the follow-up
 * clock) are left blank on purpose. A generated row is a starting row, not a
 * claim that those steps happened.
 */

export const trackerColumns = [
  "reference",
  "received_at",
  "source",
  "medium",
  "campaign",
  "landing_path",
  "company",
  "contact_name",
  "contact_email",
  "phone",
  "origin",
  "destination",
  "lane_slug",
  "lane_origin",
  "lane_destination",
  "mode",
  "cargo_type",
  "weight_kg",
  "volume_cbm",
  "incoterm",
  "hs_code",
  "frequency",
  "account_type",
  "owner",
  "status",
  "ack_sent_at",
  "quote_due_at",
  "quote_sent_at",
  "hours_to_quote",
  "quote_value_npr",
  "quote_valid_until",
  "followup_1_due",
  "followup_1_sent_at",
  "followup_2_due",
  "followup_2_sent_at",
  "followup_3_due",
  "followup_3_sent_at",
  "client_response",
  "outcome",
  "lost_reason",
  "booking_date",
  "shipment_ref",
  "booked_value_npr",
  "notes",
] as const;

export type TrackerColumn = (typeof trackerColumns)[number];
export type TrackerRow = Record<TrackerColumn, string>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Firestore hands timestamps back as Timestamp objects; JSON exports as ISO. */
function iso(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (value && typeof value === "object") {
    const stamp = value as { seconds?: number; _seconds?: number };
    const seconds = stamp.seconds ?? stamp._seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000).toISOString();
  }
  return "";
}

export function trackerRow(data: Record<string, unknown>): TrackerRow {
  const attribution = sanitizeQuoteAttribution(data.attribution);
  // Prefer what the record stored; fall back to the lane path for records
  // written before the canonical columns existed.
  const derived = quoteCorridor(attribution?.lane_path);
  const row = Object.fromEntries(trackerColumns.map((column) => [column, ""])) as TrackerRow;
  return {
    ...row,
    reference: text(data.reference),
    received_at: iso(data.created_at ?? data.received_at),
    source: attribution?.source ?? "",
    medium: attribution?.medium ?? "",
    campaign: attribution?.campaign ?? "",
    landing_path: attribution?.landing_path ?? "",
    company: text(data.company_name),
    contact_name: text(data.contact_name),
    contact_email: text(data.contact_email),
    phone: text(data.phone),
    origin: text(data.origin),
    destination: text(data.destination),
    lane_slug: text(data.lane_slug) || derived.lane_slug || "",
    lane_origin: text(data.lane_origin) || derived.lane_origin || "",
    lane_destination: text(data.lane_destination) || derived.lane_destination || "",
    mode: text(data.mode),
    cargo_type: text(data.cargo_type),
    // The tracker's weight column is kilograms; any other unit stays blank
    // rather than being converted without a factor we would have to assume.
    weight_kg: text(data.weight_unit) === "kg" ? text(data.weight) : "",
    status: text(data.status),
    quote_value_npr: text(data.quote_currency).toUpperCase() === "NPR" ? text(String(data.quoted_amount ?? "")) : "",
    quote_valid_until: iso(data.valid_until),
    shipment_ref: text(data.shipment_reference),
  };
}

function cell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function trackerCsv(records: Array<Record<string, unknown>>) {
  const lines = [trackerColumns.join(","), ...records.map((record) => trackerColumns.map((column) => cell(trackerRow(record)[column])).join(","))];
  return `${lines.join("\n")}\n`;
}
