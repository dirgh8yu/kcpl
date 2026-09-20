import { normalizePortalEmail } from "./portal-access-policy.ts";

/*
 * Customer document access log.
 *
 * Answers one question KCPL cannot currently answer: "we never received the
 * bill of lading." A released document that was downloaded leaves a record of
 * who downloaded it and when, so a dispute is settled from evidence rather
 * than from recollection.
 *
 * Two deliberate limits on what is kept:
 *
 *   1. Identity, not location. The record names the portal account that
 *      downloaded the file, because that is the fact in dispute. It does not
 *      store an IP address or a user agent: neither strengthens the answer,
 *      and both turn a dispute record into a surveillance record with a
 *      retention question nobody asked for.
 *   2. Every download, not the first. "Downloaded three times, most recently
 *      on the 4th" is a different answer from "downloaded once", and the
 *      second download is often the one that matters -- it is the colleague
 *      who was told to look.
 */

export type PortalAccessEvent = {
  id: string;
  document_id: number;
  document_type: string;
  filename: string;
  account_email: string;
  customer_id: string;
  at: string;
  size_bytes: number;
};

/** Most recent events are what a dispute asks about; the cap bounds the read. */
export const PORTAL_ACCESS_LOG_LIMIT = 500;

/**
 * Deterministic within a millisecond.
 *
 * A double-submitted download -- a double click, a retried request -- lands on
 * the same id and collapses into one event instead of inflating the count that
 * a dispute is decided on.
 */
export function portalAccessEventId(input: { documentId: number; at: string; email: string }) {
  const stamp = input.at.replace(/[^0-9]/g, "").slice(0, 17) || "0";
  const who = normalizePortalEmail(input.email)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "unknown";
  return `${input.documentId}-${stamp}-${who}`;
}

export type PortalAccessSummary = {
  document_id: number;
  document_type: string;
  filename: string;
  downloads: number;
  accounts: string[];
  first_at: string;
  last_at: string;
  last_by: string;
};

/**
 * Per-document rollup, newest activity first.
 *
 * `accounts` is distinct addresses rather than a count of events, because
 * "three people on their side have it" and "one person downloaded it three
 * times" are different answers to the same complaint.
 */
export function portalAccessSummaries(events: PortalAccessEvent[]): PortalAccessSummary[] {
  const byDocument = new Map<number, PortalAccessSummary>();
  for (const event of events) {
    const existing = byDocument.get(event.document_id);
    if (!existing) {
      byDocument.set(event.document_id, {
        document_id: event.document_id,
        document_type: event.document_type,
        filename: event.filename,
        downloads: 1,
        accounts: [event.account_email],
        first_at: event.at,
        last_at: event.at,
        last_by: event.account_email,
      });
      continue;
    }
    existing.downloads += 1;
    if (!existing.accounts.includes(event.account_email)) existing.accounts.push(event.account_email);
    if (event.at < existing.first_at) existing.first_at = event.at;
    if (event.at > existing.last_at) {
      existing.last_at = event.at;
      existing.last_by = event.account_email;
      // A later event carries the current filename: a superseded document keeps
      // the name it had when it was actually fetched.
      existing.filename = event.filename;
    }
  }
  return [...byDocument.values()].sort((a, b) => b.last_at.localeCompare(a.last_at));
}

/**
 * Released documents nobody has fetched.
 *
 * The useful half of the log for an operator: not "who has it" but "who does
 * not", while there is still time to chase it.
 */
export function portalUndownloadedDocuments(
  released: { id: number; document_type: string; filename: string }[],
  events: PortalAccessEvent[],
) {
  const fetched = new Set(events.map((event) => event.document_id));
  return released.filter((document) => !fetched.has(document.id));
}
