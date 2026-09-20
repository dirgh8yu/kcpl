import { shipmentStatusLabels, type ShipmentStatus } from "../shipment-types.ts";
import { portalDocumentReleased } from "./portal-access-policy.ts";
import { portalDocumentLabel, portalModeLabel } from "./portal-format.ts";

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

export function portalDocumentReleaseMessage(facts: PortalDocumentReleaseFacts): PortalMilestoneMessage {
  const label = portalDocumentLabel(facts.documentType);
  const lane = facts.origin && facts.destination ? `${facts.origin} → ${facts.destination}` : facts.reference;
  const subject = `${facts.reference} · ${label} ready`;

  const text = [
    `KCPL has released the ${label.toLowerCase()} for this shipment. You can download it from your portal.`,
    "",
    `Shipment: ${facts.reference}`,
    `Route: ${lane}`,
    `Document: ${label}`,
    "",
    `Download it here: ${facts.portalUrl}`,
    "",
    "You can turn these emails off in the portal under Notifications.",
  ].join("\n");

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:620px;color:#101010">`,
    `<p style="font-size:12px;font-weight:700;color:#DC143C;margin:0 0 6px">Kapileshwor Cargo</p>`,
    `<h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(label)} ready</h2>`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">KCPL has released the ${escapeHtml(label.toLowerCase())} for this shipment. You can download it from your portal.</p>`,
    `<table style="font-size:14px;line-height:1.7;border-collapse:collapse">`,
    `<tr><td style="color:#5C6675;padding-right:12px">Shipment</td><td><strong>${escapeHtml(facts.reference)}</strong></td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">Route</td><td>${escapeHtml(lane)}</td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">Document</td><td>${escapeHtml(label)}</td></tr>`,
    `</table>`,
    `<p style="margin:20px 0"><a href="${escapeHtml(facts.portalUrl)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Download the document</a></p>`,
    `<p style="font-size:11px;color:#8B95A4;line-height:1.6">Sent to ${escapeHtml(facts.customerName)} because this shipment is on your KCPL account. You can turn these emails off in the portal under Notifications.</p>`,
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
export function portalFreeTimeMessage(facts: PortalFreeTimeFacts): PortalMilestoneMessage {
  const place = facts.location ? ` at ${facts.location}` : "";
  const lane = facts.origin && facts.destination ? `${facts.origin} → ${facts.destination}` : facts.reference;
  const headline = facts.daysRemaining === 0
    ? `Today is the last free day${place}`
    : facts.daysRemaining === 1
      ? `1 free day left${place}`
      : `${facts.daysRemaining} free days left${place}`;
  const subject = `${facts.reference} · ${headline}`;

  const text = [
    `${headline}.`,
    "",
    "Once free time ends, the carrier or terminal may charge storage and demurrage for each day the cargo stays.",
    "",
    `Shipment: ${facts.reference}`,
    `Route: ${lane}`,
    facts.deadline ? `Last free day: ${facts.deadline}` : "",
    "",
    `See the shipment: ${facts.portalUrl}`,
    "",
    "Contact your KCPL account manager if you need an extension.",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:620px;color:#101010">`,
    `<p style="font-size:12px;font-weight:700;color:#DC143C;margin:0 0 6px">Kapileshwor Cargo</p>`,
    `<h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(headline)}</h2>`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">Once free time ends, the carrier or terminal may charge storage and demurrage for each day the cargo stays.</p>`,
    `<table style="font-size:14px;line-height:1.7;border-collapse:collapse">`,
    `<tr><td style="color:#5C6675;padding-right:12px">Shipment</td><td><strong>${escapeHtml(facts.reference)}</strong></td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">Route</td><td>${escapeHtml(lane)}</td></tr>`,
    facts.deadline ? `<tr><td style="color:#5C6675;padding-right:12px">Last free day</td><td>${escapeHtml(facts.deadline)}</td></tr>` : "",
    `</table>`,
    `<p style="margin:20px 0"><a href="${escapeHtml(facts.portalUrl)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">See the shipment</a></p>`,
    `<p style="font-size:11px;color:#8B95A4;line-height:1.6">Sent to ${escapeHtml(facts.customerName)} because this shipment is on your KCPL account. Contact your account manager if you need an extension. You can turn these emails off in the portal under Notifications.</p>`,
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

function statusSentence(status: string, facts: PortalMilestoneFacts) {
  if (status === "delivered") return "This shipment has been delivered.";
  if (status === "exception") return "KCPL has flagged an issue on this shipment and is working on it.";
  if (status === "out_for_delivery") return "The cargo is out for final delivery.";
  if (status === "customs_clearance") return "The cargo is in customs clearance.";
  if (status === "in_transit") return facts.currentLocation
    ? `The cargo is in transit, last reported at ${facts.currentLocation}.`
    : "The cargo is in transit.";
  return "KCPL has confirmed the booking for this shipment.";
}

/**
 * Build the milestone email.
 *
 * The input type is the whole contract: operational facts only. There is no
 * parameter here through which a price, a cost, a supplier or a staff note
 * could reach a customer's inbox.
 */
export function portalMilestoneMessage(facts: PortalMilestoneFacts): PortalMilestoneMessage {
  const statusLabel = shipmentStatusLabels[facts.status as ShipmentStatus] ?? "Shipment update";
  const lane = facts.origin && facts.destination ? `${facts.origin} → ${facts.destination}` : facts.reference;
  const subject = `${facts.reference} · ${statusLabel}`;

  const lines = [
    statusSentence(facts.status, facts),
    "",
    `Shipment: ${facts.reference}`,
    `Route: ${lane}`,
    `Mode: ${portalModeLabel(facts.mode)}`,
    `Status: ${statusLabel}`,
  ];
  if (facts.eta) lines.push(`Estimated arrival: ${facts.eta.slice(0, 10)}`);
  lines.push("", `Track it in your KCPL portal: ${facts.portalUrl}`, "",
    "You can turn these emails off in the portal under Notifications.");

  const html = [
    `<div style="font-family:Arial,sans-serif;max-width:620px;color:#101010">`,
    `<p style="font-size:12px;font-weight:700;color:#DC143C;margin:0 0 6px">Kapileshwor Cargo</p>`,
    `<h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(statusLabel)}</h2>`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(statusSentence(facts.status, facts))}</p>`,
    `<table style="font-size:14px;line-height:1.7;border-collapse:collapse">`,
    `<tr><td style="color:#5C6675;padding-right:12px">Shipment</td><td><strong>${escapeHtml(facts.reference)}</strong></td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">Route</td><td>${escapeHtml(lane)}</td></tr>`,
    `<tr><td style="color:#5C6675;padding-right:12px">Mode</td><td>${escapeHtml(portalModeLabel(facts.mode))}</td></tr>`,
    facts.eta ? `<tr><td style="color:#5C6675;padding-right:12px">Estimated arrival</td><td>${escapeHtml(facts.eta.slice(0, 10))}</td></tr>` : "",
    `</table>`,
    `<p style="margin:20px 0"><a href="${escapeHtml(facts.portalUrl)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Open the shipment</a></p>`,
    `<p style="font-size:11px;color:#8B95A4;line-height:1.6">Sent to ${escapeHtml(facts.customerName)} because this shipment is on your KCPL account. You can turn these emails off in the portal under Notifications.</p>`,
    `</div>`,
  ].join("");

  return { subject, text: lines.join("\n"), html };
}
