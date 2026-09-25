/*
 * Rules for push to the KCPL apps (Firebase Cloud Messaging), kept free of
 * server imports so they can be tested directly. Delivery lives in
 * mobile-push.server.ts.
 *
 * Push is a transport, never a second policy. The customer app gets exactly
 * the facts the portal's notification sweep already decided to email, under
 * the same once-per-fact claim. The staff app gets the notifications the web
 * notification centre already holds for that person.
 */

import { createHash } from "node:crypto";

export const mobilePushAudiences = ["customer", "staff"] as const;
export type MobilePushAudience = (typeof mobilePushAudiences)[number];

export const mobilePushPlatforms = ["android", "ios"] as const;
export type MobilePushPlatform = (typeof mobilePushPlatforms)[number];

/** FCM registration tokens are long opaque strings of a known alphabet. */
const TOKEN_PATTERN = /^[A-Za-z0-9_:\-.]{32,4096}$/;

export function mobilePushToken(value: unknown): string | null {
  return typeof value === "string" && TOKEN_PATTERN.test(value.trim()) ? value.trim() : null;
}

export function mobilePushPlatform(value: unknown): MobilePushPlatform | null {
  return mobilePushPlatforms.includes(value as MobilePushPlatform) ? value as MobilePushPlatform : null;
}

/**
 * The device row id: the token hashed, so the same phone registering again
 * refreshes its row instead of adding a second one that would buzz twice, and
 * the raw token never appears as a document id in logs or the console.
 */
export function mobileDeviceId(audience: MobilePushAudience, token: string) {
  return `${audience}-${createHash("sha256").update(token).digest("hex").slice(0, 40)}`;
}

/** What the app does when the notification is tapped. */
export type MobilePushTarget = { kind: "shipment" | "invoice" | "job" | "alerts"; reference: string | null };

/** A portal link becomes the shipment the app should open. */
export function customerPushTarget(url: string): MobilePushTarget {
  const match = /\/portal\/shipments\/([^/?#]+)/.exec(url);
  if (match) return { kind: "shipment", reference: decodeURIComponent(match[1]) };
  // An invoice reminder opens the invoice, where it can be paid.
  const invoice = /\/portal\/invoices\/([^/?#]+)/.exec(url);
  return invoice ? { kind: "invoice", reference: decodeURIComponent(invoice[1]) } : { kind: "alerts", reference: null };
}

/** An admin link becomes the job the staff app should open. */
export function staffPushTarget(actionPath: string): MobilePushTarget {
  const match = /\/admin\/(?:jobs|shipments)\/([A-Za-z0-9-]+)/.exec(actionPath);
  return match ? { kind: "job", reference: match[1] } : { kind: "alerts", reference: null };
}

/**
 * Whether a staff notification should reach the phone.
 *
 * Register transitions are the exception: the web register writes them for
 * status changes the person has just watched arrive on their own screen, as
 * a history, not news. Everything else a person is sent (assignments, tasks,
 * customs, documents, alerts) is worth a buzz, within their muted categories.
 */
export function staffNotificationPushes(input: {
  sourceType: string | null | undefined;
  category: string;
  categories: Record<string, boolean>;
}) {
  if (input.sourceType === "register-transition") return false;
  return input.categories[input.category] !== false;
}

/**
 * FCM errors that mean the token is gone for good (the app was
 * uninstalled, or the token rotated). The device row is dropped rather than
 * pushed into again on every sweep.
 */
export function mobilePushTokenDead(code: string | undefined) {
  return code === "messaging/registration-token-not-registered"
    || code === "messaging/invalid-registration-token"
    || code === "messaging/invalid-argument";
}

/*
 * Live Activities: a shipment on the iPhone lock screen and Dynamic Island.
 * The content state is what the widget extension draws (ios/KCPLWidget), in
 * the reader's language, and the same keys as its Swift ContentState.
 */

export type LiveActivityState = { status: string; detail: string; progress: number; attention: boolean };

const liveStages = ["booking_confirmed", "preparing", "in_transit", "customs_clearance", "out_for_delivery", "delivered"];

export function liveActivityState(
  shipment: Record<string, unknown>,
  label: (status: string) => string,
  expected: (date: string) => string,
): LiveActivityState {
  const status = typeof shipment.status === "string" ? shipment.status : "booking_confirmed";
  const stage = liveStages.indexOf(status);
  const location = typeof shipment.current_location === "string" ? shipment.current_location.trim() : "";
  const eta = typeof shipment.eta === "string" ? shipment.eta.trim() : "";
  return {
    status: label(status),
    detail: status !== "delivered" && location ? location : eta && status !== "delivered" ? expected(eta) : "",
    progress: stage < 0 ? 0.05 : Math.max(0.05, stage / (liveStages.length - 1)),
    attention: status === "exception",
  };
}

/** A delivered shipment's activity ends: the lock screen has nothing more to follow. */
export function liveActivityEnds(shipment: Record<string, unknown>) {
  return shipment.status === "delivered";
}

/** The Android follow's update, as FCM data (strings only). The app handles
 * it in lib/push, moving or ending its ongoing notification. */
export function androidLiveData(reference: string, state: LiveActivityState, ends: boolean): Record<string, string> {
  return {
    kind: "live",
    reference,
    event: ends ? "end" : "update",
    status: state.status,
    detail: state.detail,
    progress: String(Math.round(Math.min(1, Math.max(0, state.progress)) * 100) / 100),
    attention: state.attention ? "1" : "0",
  };
}
