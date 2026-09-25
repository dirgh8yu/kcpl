/*
 * A shipment's status for someone without a KCPL login: a consignee, a
 * driver, a colleague at the receiving warehouse. Pure rules, tested directly.
 *
 * The link is the only credential, so it is long, random and unguessable, it
 * expires, and it can be withdrawn. Only its hash is stored: a read of the
 * database yields no working link. What it shows is narrower than the
 * portal: where the cargo is going, where it is, when it is expected, and the
 * milestones by title. No customer name, carrier reference, note, document,
 * price or milestone detail.
 */

import { createHash, randomBytes } from "node:crypto";

export const TRACKING_LINK_DAYS = 30;

export function newTrackingToken() {
  return randomBytes(24).toString("base64url");
}

/** What the database keys a link by. */
export function trackingTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** A token as a link carries it: 32 URL-safe characters, nothing else. */
export function trackingTokenShapeValid(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32}$/.test(token);
}

export function trackingLinkLive(link: Record<string, unknown> | null | undefined, now = new Date()) {
  if (!link) return false;
  if (link.revoked_at) return false;
  const expires = typeof link.expires_at === "string" ? Date.parse(link.expires_at) : Number.NaN;
  return Number.isFinite(expires) && expires > now.getTime();
}

const stages = ["booking_confirmed", "preparing", "in_transit", "customs_clearance", "out_for_delivery", "delivered"];

export type PublicTrackingView = {
  reference: string;
  status: string;
  mode: string;
  origin: string;
  destination: string;
  eta: string | null;
  current_location: string | null;
  updated_at: string;
  /** 0 to 1 along the journey. */
  progress: number;
  milestones: { title: string; location: string | null; at: string }[];
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** "Kolkata" from "Kolkata, India": a place, never an address. */
function place(value: unknown) {
  return text(value).split(",")[0].trim();
}

export function publicTrackingView(reference: string, shipment: Record<string, unknown>, events: Record<string, unknown>[]): PublicTrackingView {
  const status = text(shipment.status, "booking_confirmed");
  const stage = stages.indexOf(status);
  return {
    reference,
    status,
    mode: text(shipment.mode, "unsure"),
    origin: place(shipment.origin),
    destination: place(shipment.destination),
    eta: nullableText(shipment.eta),
    current_location: status === "delivered" ? null : nullableText(shipment.current_location),
    updated_at: text(shipment.updated_at),
    progress: stage < 0 ? 0.05 : Math.max(0.05, stage / (stages.length - 1)),
    milestones: events.slice(0, 20).map((event) => ({
      title: text(event.title, "Shipment update"),
      location: nullableText(event.location),
      at: text(event.event_time),
    })),
  };
}
