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
export type MobilePushTarget = { kind: "shipment" | "job" | "alerts"; reference: string | null };

/** A portal link becomes the shipment the app should open. */
export function customerPushTarget(url: string): MobilePushTarget {
  const match = /\/portal\/shipments\/([^/?#]+)/.exec(url);
  return match ? { kind: "shipment", reference: decodeURIComponent(match[1]) } : { kind: "alerts", reference: null };
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
