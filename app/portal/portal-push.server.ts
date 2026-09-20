import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { encryptPushPayload, pushSubscriptionId, vapidAuthorization, type VapidKeys } from "./portal-push-crypto";
import { portalLocaleValue, type PortalLocale } from "./portal-i18n";

/*
 * Web push subscriptions and delivery.
 *
 * Push is a second transport for notifications KCPL already decides to send,
 * not a second set of rules about what to send. Everything about whether a
 * customer hears about a fact -- the topic preference, the baseline, the
 * deterministic key -- stays in portal-notifications.ts, which is pure. This
 * module only knows how to get an already-decided message onto a phone.
 *
 * A subscription is not a secret KCPL chose: the browser mints it, and it is
 * only useful to whoever holds it alongside a matching VAPID key. It is still
 * scoped to the account that created it, so a customer can only ever list or
 * remove their own.
 */

const SUBSCRIPTIONS = "portal_push_subscriptions";

export type PortalPushSubscription = {
  id: string;
  email: string;
  customer_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: PortalLocale;
  created_at: string;
};

export function portalPushPublicKey() {
  return process.env.KCPL_VAPID_PUBLIC_KEY?.trim() ?? "";
}

function vapidKeys(): VapidKeys | null {
  const publicKey = portalPushPublicKey();
  const privateKey = process.env.KCPL_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.KCPL_VAPID_SUBJECT?.trim() ?? "";
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

/** Push is off unless all three VAPID values are configured. */
export function portalPushConfigured() {
  return vapidKeys() !== null;
}

function subscriptionFrom(id: string, data: Record<string, unknown>): PortalPushSubscription {
  const text = (value: unknown) => typeof value === "string" ? value : "";
  return {
    id,
    email: text(data.email),
    customer_id: text(data.customer_id),
    endpoint: text(data.endpoint),
    p256dh: text(data.p256dh),
    auth: text(data.auth),
    locale: portalLocaleValue(data.locale),
    created_at: text(data.created_at),
  };
}

/**
 * Record one browser's subscription for one account.
 *
 * Keyed by the endpoint, so re-subscribing the same browser refreshes the row
 * rather than accumulating a duplicate that would push twice to one phone.
 */
export async function savePortalPushSubscription(input: {
  email: string;
  customerId: string;
  locale: PortalLocale;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const endpoint = input.endpoint.trim();
  if (!/^https:\/\//.test(endpoint)) return { kind: "invalid" as const };
  if (!input.p256dh.trim() || !input.auth.trim()) return { kind: "invalid" as const };

  const now = new Date().toISOString();
  try {
    await firebaseAdminDb().collection(SUBSCRIPTIONS).doc(pushSubscriptionId(endpoint)).set({
      email: input.email.trim().toLowerCase(),
      customer_id: input.customerId,
      endpoint,
      p256dh: input.p256dh.trim(),
      auth: input.auth.trim(),
      locale: portalLocaleValue(input.locale),
      created_at: now,
      updated_at: now,
    });
    return { kind: "saved" as const };
  } catch (error) {
    console.error("KCPL portal push subscription save failed", error);
    return { kind: "unavailable" as const };
  }
}

/**
 * Remove a subscription.
 *
 * The account's own email is required as well as the endpoint, so knowing an
 * endpoint is not enough to silence somebody else's phone.
 */
export async function deletePortalPushSubscription(email: string, endpoint: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  try {
    const reference = firebaseAdminDb().collection(SUBSCRIPTIONS).doc(pushSubscriptionId(endpoint));
    const snapshot = await reference.get();
    if (!snapshot.exists) return { kind: "removed" as const };
    if (snapshot.get("email") !== email.trim().toLowerCase()) return { kind: "forbidden" as const };
    await reference.delete();
    return { kind: "removed" as const };
  } catch (error) {
    console.error("KCPL portal push subscription delete failed", error);
    return { kind: "unavailable" as const };
  }
}

/** Every subscription on the portal, grouped by the account that owns it. */
export async function portalPushSubscriptionsByEmail() {
  if (!firebaseRuntimeConfigured()) return new Map<string, PortalPushSubscription[]>();
  try {
    const snapshot = await firebaseAdminDb().collection(SUBSCRIPTIONS).limit(2000).get();
    const byEmail = new Map<string, PortalPushSubscription[]>();
    for (const document of snapshot.docs) {
      const subscription = subscriptionFrom(document.id, document.data() as Record<string, unknown>);
      if (!subscription.email || !subscription.endpoint) continue;
      byEmail.set(subscription.email, [...(byEmail.get(subscription.email) ?? []), subscription]);
    }
    return byEmail;
  } catch (error) {
    console.error("KCPL portal push subscription scan failed", error);
    return new Map<string, PortalPushSubscription[]>();
  }
}

export type PortalPushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
  lang: PortalLocale;
};

/**
 * Deliver one message to one browser.
 *
 * A push service answering 404 or 410 is telling KCPL the subscription is
 * dead -- the browser was uninstalled, the permission revoked, the endpoint
 * rotated. That is not an error to retry: the row is removed so the next
 * sweep does not keep pushing into nothing.
 */
export async function sendPortalPush(subscription: PortalPushSubscription, message: PortalPushMessage) {
  const keys = vapidKeys();
  if (!keys) return { kind: "unconfigured" as const };

  let body: Buffer;
  let authorization: string;
  try {
    body = encryptPushPayload({
      payload: JSON.stringify(message),
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    });
    authorization = vapidAuthorization({ endpoint: subscription.endpoint, keys });
  } catch (error) {
    // A subscription we cannot encrypt for is unusable, and will stay that
    // way: drop it rather than failing this shipment on every sweep.
    console.error("KCPL portal push encryption failed", error);
    await dropSubscription(subscription.id);
    return { kind: "expired" as const };
  }

  try {
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        authorization,
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: "86400",
        urgency: "normal",
      },
      body: new Uint8Array(body),
    });

    if (response.status === 404 || response.status === 410) {
      await dropSubscription(subscription.id);
      return { kind: "expired" as const };
    }
    if (!response.ok) {
      console.error("KCPL portal push rejected", { status: response.status, endpoint: new URL(subscription.endpoint).origin });
      return { kind: "failed" as const };
    }
    return { kind: "sent" as const };
  } catch (error) {
    console.error("KCPL portal push delivery failed", error);
    return { kind: "failed" as const };
  }
}

async function dropSubscription(id: string) {
  try {
    await firebaseAdminDb().collection(SUBSCRIPTIONS).doc(id).delete();
  } catch {
    // A subscription that cannot be removed is retried next sweep; it must
    // not fail the notification run.
  }
}
