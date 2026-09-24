import { firebaseAdminDb, firebaseAdminMessaging, firebaseRuntimeConfigured } from "./firebase-admin.server";
import {
  mobileDeviceId,
  mobilePushTokenDead,
  type MobilePushAudience,
  type MobilePushPlatform,
  type MobilePushTarget,
} from "./mobile-push-policy";

/*
 * Push to the KCPL apps through Firebase Cloud Messaging.
 *
 * A device row belongs to one login in one app. The apps register after
 * sign-in and remove the row on sign-out, so a shared phone never buzzes
 * with the previous person's shipments. Rows are only ever read here, by
 * the email they belong to; nothing lists another account's devices.
 */

const DEVICES = "mobile_push_devices";

export type MobileDevice = {
  id: string;
  audience: MobilePushAudience;
  email: string;
  uid: string;
  token: string;
  platform: MobilePushPlatform;
};

export async function saveMobileDevice(input: Omit<MobileDevice, "id">) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const now = new Date().toISOString();
  const id = mobileDeviceId(input.audience, input.token);
  await firebaseAdminDb().collection(DEVICES).doc(id).set({
    audience: input.audience,
    email: input.email.trim().toLowerCase(),
    uid: input.uid,
    token: input.token,
    platform: input.platform,
    updated_at: now,
  }, { merge: true });
  return { kind: "saved" as const };
}

/** Removes a device, but only the caller's own: the row must carry their email. */
export async function deleteMobileDevice(audience: MobilePushAudience, email: string, token: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const reference = firebaseAdminDb().collection(DEVICES).doc(mobileDeviceId(audience, token));
  const snapshot = await reference.get();
  if (snapshot.exists && snapshot.get("email") === email.trim().toLowerCase()) await reference.delete();
  return { kind: "deleted" as const };
}

export async function mobileDevicesFor(audience: MobilePushAudience, email: string): Promise<MobileDevice[]> {
  if (!firebaseRuntimeConfigured()) return [];
  try {
    const snapshot = await firebaseAdminDb().collection(DEVICES)
      .where("email", "==", email.trim().toLowerCase())
      .limit(20)
      .get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<MobileDevice, "id">) }))
      .filter((device) => device.audience === audience && typeof device.token === "string" && device.token.length > 0);
  } catch (error) {
    console.error("KCPL mobile push device lookup failed", error);
    return [];
  }
}

export type MobilePushMessage = {
  title: string;
  body: string;
  target: MobilePushTarget;
  /** Collapses repeats of the same fact into one notification on the phone. */
  tag: string;
};

/**
 * Sends one message to a person's devices. Never throws: an undelivered push
 * must not cost the email or the notification record carrying the same news.
 */
export async function sendMobilePush(devices: MobileDevice[], message: MobilePushMessage) {
  if (!devices.length) return { sent: 0 };
  const data: Record<string, string> = { kind: message.target.kind, reference: message.target.reference ?? "" };
  try {
    const response = await firebaseAdminMessaging().sendEachForMulticast({
      tokens: devices.map((device) => device.token),
      notification: { title: message.title.slice(0, 120), body: message.body.slice(0, 400) },
      data,
      android: {
        priority: "high",
        collapseKey: message.tag.slice(0, 64),
        notification: { tag: message.tag.slice(0, 64), color: "#DC143C" },
      },
      apns: { headers: { "apns-collapse-id": message.tag.slice(0, 64) }, payload: { aps: { sound: "default" } } },
    });
    const dead = response.responses
      .map((result, index) => (!result.success && mobilePushTokenDead(result.error?.code) ? devices[index].id : null))
      .filter((id): id is string => id !== null);
    if (dead.length) {
      const db = firebaseAdminDb();
      await Promise.allSettled(dead.map((id) => db.collection(DEVICES).doc(id).delete()));
    }
    return { sent: response.successCount };
  } catch (error) {
    console.error("KCPL mobile push delivery failed", error);
    return { sent: 0 };
  }
}
