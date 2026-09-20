import { shipmentStatusLabels, type ShipmentStatus } from "../shipment-types.ts";
import { portalDocumentReleased } from "./portal-access-policy.ts";
import { portalDocumentLabel, portalModeLabel, portalStatusLabel } from "./portal-format.ts";
import { portalText, type PortalLocale, type PortalTextKey } from "./portal-i18n.ts";

/*
 * Customer notification policy.
 *
 * Pure, like the access policy: what a customer is told, when, and in what
 * words is decided here so it can be tested without a mail provider.
 *
 * Two rules this module exists to keep:
 *
 *   1. A notification says no more than the portal itself would show. The copy
 *      builder takes a fixed set of operational fields and has no route to a
 *      rate, a margin, a supplier or an internal note -- an email cannot leak
 *      what the screen already redacts.
 *   2. Nothing is sent twice. Every message carries a deterministic key derived
 *      from the fact that caused it, so a re-run of the scheduled sweep
 *      recognises what it already sent rather than mailing the customer again.
 */

export const portalNotificationTopics = ["shipment_updates", "documents", "free_time"] as const;
export type PortalNotificationTopic = (typeof portalNotificationTopics)[number];

export const portalNotificationTopicLabels: Record<PortalNotificationTopic, string> = {
  shipment_updates: "Shipment milestones",
  documents: "Document requests and releases",
  free_time: "Free time running out",
};

export const portalNotificationTopicHints: Record<PortalNotificationTopic, string> = {
  shipment_updates: "When a shipment is booked, moves, clears customs, is out for delivery or is delivered.",
  documents: "When KCPL needs paperwork from you, or releases a document to your account.",
  free_time: "Before storage or demurrage charges start on cargo at a port or depot.",
};

/** The same topics in the reader's language. The English maps above remain for
 * staff-side surfaces, which are not translated. */
export function portalNotificationTopicLabel(topic: PortalNotificationTopic, locale: PortalLocale) {
  return portalText(locale, `topic.${topic}`);
}

export function portalNotificationTopicHint(topic: PortalNotificationTopic, locale: PortalLocale) {
  return portalText(locale, `topic.${topic}_hint`);
}

export type PortalNotificationPreferences = Record<PortalNotificationTopic, boolean>;

/**
 * Absent preferences mean subscribed. A customer who was given portal access
 * expects to hear about their own cargo; silence is the surprising default, and
 * every topic is switchable from the portal itself.
 */
export function portalNotificationPreferences(record: Record<string, unknown> | null | undefined): PortalNotificationPreferences {
  const stored = record && typeof record.notification_preferences === "object" && record.notification_preferences
    ? record.notification_preferences as Record<string, unknown>
    : {};
  return {
    shipment_updates: stored.shipment_updates !== false,
    documents: stored.documents !== false,
    free_time: stored.free_time !== false,
  };
}

export function portalNotificationTopicValue(value: unknown): PortalNotificationTopic | null {
  return portalNotificationTopics.includes(value as PortalNotificationTopic) ? value as PortalNotificationTopic : null;
}

/**
 * Statuses worth an email. `preparing` is deliberately excluded: it is an
 * internal readiness step that changes nothing the customer can act on, and a
 * notification that teaches people to ignore notifications is worse than none.
 */
const notifiableStatuses = new Set<string>([
  "booking_confirmed",
  "in_transit",
  "customs_clearance",
  "out_for_delivery",
  "delivered",
  "exception",
]);

export function portalNotifiableStatusChange(previous: string | null, next: string) {
  if (!notifiableStatuses.has(next)) return false;
  // The first observation of a shipment is not news: the sweep would otherwise
  // mail a customer about every shipment already on their account the day
  // notifications are switched on.
  if (previous === null) return false;
  return previous !== next;
}

/** The lane line, falling back to the reference when a leg is unrecorded. */
function lane(facts: { origin: string; destination: string; reference: string }) {
  return facts.origin && facts.destination ? `${facts.origin} → ${facts.destination}` : facts.reference;
}

/** Deterministic, so a repeated sweep recognises what it already sent. */
export function portalNotificationKey(input: { topic: PortalNotificationTopic; reference: string; fact: string; recipient: string }) {
  return `portal:${input.topic}:${input.reference}:${input.fact}:${input.recipient.trim().toLowerCase()}`;
}

/* ------------------------------------------------------------------ *
 * Released documents
 * ------------------------------------------------------------------ */

/**
 * When a document became the customer's to see.
 *
 * `reviewed_at` is written every time staff act on a document, which is what
 * releasing one is; an unreviewed document falls back to its upload time.
 */
export function portalDocumentReleaseTime(document: Record<string, unknown>) {
  const reviewed = typeof document.reviewed_at === "string" ? document.reviewed_at.trim() : "";
  if (reviewed) return reviewed;
  const uploaded = typeof document.uploaded_at === "string" ? document.uploaded_at.trim() : "";
  return uploaded || null;
}

/**
 * Whether a released document is worth an email.
 *
 * `baseline` is the moment this shipment first came under notification, and it
 * is what stops switching the topic on from mailing a customer their entire
 * back catalogue of paperwork. A document released before the portal started
 * watching is already visible to them; only a new release is news.
 *
 * A document the customer sent themselves is never notified back to them.
 */
export function portalNotifiableDocumentRelease(input: {
  document: Record<string, unknown>;
  baseline: string | null;
  now?: Date;
}) {
  if (!portalDocumentReleased(input.document, input.now ?? new Date())) return false;
  if (input.document.uploaded_by_source === "customer_portal") return false;
  if (!input.baseline) return false;
  const released = portalDocumentReleaseTime(input.document);
  return Boolean(released && released > input.baseline);
}

export type PortalDocumentReleaseFacts = {
  reference: string;
  documentType: string;
  filename: string;
  origin: string;
  destination: string;
  customerName: string;
  portalUrl: string;
};

export function portalDocumentReleaseMessage(facts: PortalDocumentReleaseFacts, locale: PortalLocale = "en"): PortalMilestoneMessage {
  const say = (key: PortalTextKey, vars?: Record<string, string | number>) => portalText(locale, key, vars);
  const label = portalDocumentLabel(facts.documentType, locale);
  const lane = facts.origin && facts.destination ? `${facts.origin} → ${facts.destination}` : facts.reference;
  // Lower-cased mid-sentence only in English. Devanagari has no letter case,
  // and `toLowerCase()` on a Nepali label is a no-op that reads as a bug.
  const inline = locale === "en" ? label.toLowerCase() : label;
  const subject = `${facts.reference} · ${say("mail.doc_subject", { document: label })}`;

  const text = [
    say("mail.doc_body", { document: inline }),
    "",
    `${say("mail.label_shipment")}: ${facts.reference}`,
    `${say("mail.label_route")}: ${lane}`,
    `${say("mail.label_document")}: ${label}`,
    "",
    say("mail.doc_download_line", { url: facts.portalUrl }),
    "",
    say("mail.turn_off"),
  ].join("\n");

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:620px;color:#101010">`,
    `<p style="font-size:12px;font-weight:700;color:#DC143C;margin:0 0 6px">${escapeHtml(say("mail.brand"))}</p>`,
    `<h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(say("mail.doc_subject", { document: label }))}</h2>`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(say("mail.doc_body", { document: inline }))}</p>`,
    `<table style="font-size:14px;line-height:1.7;border-collapse:collapse">`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_shipment"))}</td><td><strong>${escapeHtml(facts.reference)}</strong></td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_route"))}</td><td>${escapeHtml(lane)}</td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_document"))}</td><td>${escapeHtml(label)}</td></tr>`,
    `</table>`,
    `<p style="margin:20px 0"><a href="${escapeHtml(facts.portalUrl)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">${escapeHtml(say("mail.doc_download"))}</a></p>`,
    `<p style="font-size:11px;color:#8B95A4;line-height:1.6">${escapeHtml(say("mail.sent_because", { customer: facts.customerName }))}</p>`,
    `</div>`,
  ].join("");

  return { subject, text, html };
}

export type PortalFreeTimeFacts = {
  reference: string;
  origin: string;
  destination: string;
  location: string | null;
  daysRemaining: number;
  deadline: string | null;
  customerName: string;
  portalUrl: string;
};

/**
 * The free-time warning.
 *
 * Deliberately blunt about the consequence, because a countdown that does not
 * say what happens at zero is just a date. It never states a charge amount: the
 * rate KCPL records is what the carrier quoted, not an invoice, and putting a
 * number in an inbox would read as one.
 */
export function portalFreeTimeMessage(facts: PortalFreeTimeFacts, locale: PortalLocale = "en"): PortalMilestoneMessage {
  const say = (key: PortalTextKey, vars?: Record<string, string | number>) => portalText(locale, key, vars);
  const location = facts.location ?? "";
  // With- and without-location templates, as in the portal itself: Nepali puts
  // the place before the subject, so a glued-on phrase reads as broken Nepali.
  const headlineKey = facts.daysRemaining === 0
    ? "mail.ft_last_day"
    : facts.daysRemaining === 1
      ? "mail.ft_one_day"
      : "mail.ft_days";
  const headline = say((location ? `${headlineKey}_at` : headlineKey) as PortalTextKey, {
    location,
    days: facts.daysRemaining,
  });
  const subject = `${facts.reference} · ${headline}`;

  const text = [
    `${headline}.`,
    "",
    say("free_time.consequence"),
    "",
    `${say("mail.label_shipment")}: ${facts.reference}`,
    `${say("mail.label_route")}: ${lane(facts)}`,
    facts.deadline ? `${say("mail.label_last_free_day")}: ${facts.deadline}` : "",
    "",
    say("mail.see_shipment_line", { url: facts.portalUrl }),
    "",
    say("mail.free_time_extension"),
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:620px;color:#101010">`,
    `<p style="font-size:12px;font-weight:700;color:#DC143C;margin:0 0 6px">${escapeHtml(say("mail.brand"))}</p>`,
    `<h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(headline)}</h2>`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(say("free_time.consequence"))}</p>`,
    `<table style="font-size:14px;line-height:1.7;border-collapse:collapse">`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_shipment"))}</td><td><strong>${escapeHtml(facts.reference)}</strong></td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_route"))}</td><td>${escapeHtml(lane(facts))}</td></tr>`,
    facts.deadline ? `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_last_free_day"))}</td><td>${escapeHtml(facts.deadline)}</td></tr>` : "",
    `</table>`,
    `<p style="margin:20px 0"><a href="${escapeHtml(facts.portalUrl)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">${escapeHtml(say("mail.see_shipment"))}</a></p>`,
    `<p style="font-size:11px;color:#8B95A4;line-height:1.6">${escapeHtml(say("mail.free_time_sent_because", { customer: facts.customerName }))}</p>`,
    `</div>`,
  ].join("");

  return { subject, text, html };
}

export type PortalMilestoneMessage = {
  subject: string;
  text: string;
  html: string;
};

export type PortalMilestoneFacts = {
  reference: string;
  status: string;
  mode: string;
  origin: string;
  destination: string;
  eta: string | null;
  currentLocation: string | null;
  customerName: string;
  portalUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function statusSentence(status: string, facts: PortalMilestoneFacts, locale: PortalLocale) {
  const say = (key: PortalTextKey, vars?: Record<string, string | number>) => portalText(locale, key, vars);
  if (status === "delivered") return say("mail.status_delivered");
  if (status === "exception") return say("mail.status_exception");
  if (status === "out_for_delivery") return say("mail.status_out_for_delivery");
  if (status === "customs_clearance") return say("mail.status_customs");
  if (status === "in_transit") return facts.currentLocation
    ? say("mail.status_in_transit_at", { location: facts.currentLocation })
    : say("mail.status_in_transit");
  return say("mail.status_booked");
}

/**
 * Build the milestone email.
 *
 * The input type is the whole contract: operational facts only. There is no
 * parameter here through which a price, a cost, a supplier or a staff note
 * could reach a customer's inbox.
 */
export function portalMilestoneMessage(facts: PortalMilestoneFacts, locale: PortalLocale = "en"): PortalMilestoneMessage {
  const say = (key: PortalTextKey, vars?: Record<string, string | number>) => portalText(locale, key, vars);
  const statusLabel = locale === "en"
    ? shipmentStatusLabels[facts.status as ShipmentStatus] ?? "Shipment update"
    : portalStatusLabel(facts.status, locale);
  const lane = facts.origin && facts.destination ? `${facts.origin} → ${facts.destination}` : facts.reference;
  const subject = `${facts.reference} · ${statusLabel}`;

  const lines = [
    statusSentence(facts.status, facts, locale),
    "",
    `${say("mail.label_shipment")}: ${facts.reference}`,
    `${say("mail.label_route")}: ${lane}`,
    `${say("mail.label_mode")}: ${portalModeLabel(facts.mode, locale)}`,
    `${say("mail.label_status")}: ${statusLabel}`,
  ];
  if (facts.eta) lines.push(`${say("mail.label_eta")}: ${facts.eta.slice(0, 10)}`);
  lines.push("", say("mail.track_line", { url: facts.portalUrl }), "", say("mail.turn_off"));

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:620px;color:#101010">`,
    `<p style="font-size:12px;font-weight:700;color:#DC143C;margin:0 0 6px">${escapeHtml(say("mail.brand"))}</p>`,
    `<h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(statusLabel)}</h2>`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(statusSentence(facts.status, facts, locale))}</p>`,
    `<table style="font-size:14px;line-height:1.7;border-collapse:collapse">`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_shipment"))}</td><td><strong>${escapeHtml(facts.reference)}</strong></td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_route"))}</td><td>${escapeHtml(lane)}</td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_mode"))}</td><td>${escapeHtml(portalModeLabel(facts.mode, locale))}</td></tr>`,
    facts.eta ? `<tr><td style="color:#5C6675;padding-right:12px">${escapeHtml(say("mail.label_eta"))}</td><td>${escapeHtml(facts.eta.slice(0, 10))}</td></tr>` : "",
    `</table>`,
    `<p style="margin:20px 0"><a href="${escapeHtml(facts.portalUrl)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">${escapeHtml(say("mail.open_shipment"))}</a></p>`,
    `<p style="font-size:11px;color:#8B95A4;line-height:1.6">${escapeHtml(say("mail.sent_because", { customer: facts.customerName }))}</p>`,
    `</div>`,
  ].join("");

  return { subject, text: lines.join("\n"), html };
}
