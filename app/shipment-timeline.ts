/*
 * One read model for shipment activity.
 *
 * The records already exist in several places: milestones, document uploads,
 * confirmations, ratings and internal job activity. This module does not
 * duplicate them; it normalises the customer- and partner-visible parts into a
 * single ordered feed so a screen cannot show a document arriving after a
 * milestone that was actually recorded later.
 *
 * Audience is explicit. Internal job activity is never passed into this model
 * for a customer or partner view, and a document is included only when the
 * caller has already applied the portal or partner release rules.
 */

export const timelineAudiences = ["internal", "customer", "partner", "public"] as const;
export type TimelineAudience = (typeof timelineAudiences)[number];

export const timelineKinds = ["milestone", "document", "confirmation", "rating", "message", "bill"] as const;
export type TimelineKind = (typeof timelineKinds)[number];

export type TimelineEntry = {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail: string | null;
  location: string | null;
  audience: TimelineAudience;
};

export type TimelineEventInput = {
  id: string;
  title: string;
  details?: string | null;
  location?: string | null;
  event_time: string;
};

export type TimelineDocumentInput = {
  id: string | number;
  filename: string;
  document_type: string;
  uploaded_at: string;
};

export function mergeTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function portalTimeline(
  events: TimelineEventInput[],
  documents: TimelineDocumentInput[],
  confirmation: { confirmed_at: string; received_by: string | null } | null,
): TimelineEntry[] {
  const entries: TimelineEntry[] = events.map((event) => ({
    id: `event:${event.id}`,
    at: event.event_time,
    kind: "milestone",
    title: event.title,
    detail: event.details || null,
    location: event.location || null,
    audience: "customer",
  }));
  for (const document of documents) {
    entries.push({
      id: `document:${document.id}`,
      at: document.uploaded_at,
      kind: "document",
      title: document.filename,
      detail: document.document_type,
      location: null,
      audience: "customer",
    });
  }
  if (confirmation) {
    entries.push({
      id: "confirmation",
      at: confirmation.confirmed_at,
      kind: "confirmation",
      title: "Delivery confirmed",
      detail: confirmation.received_by ? `Received by ${confirmation.received_by}` : null,
      location: null,
      audience: "customer",
    });
  }
  return mergeTimeline(entries);
}
