import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseAdminMessaging, firebaseRuntimeConfigured } from "./firebase-admin.server";
import {
  mobileDeviceId,
  androidLiveData,
  liveActivityEnds,
  mobilePushTokenDead,
  type LiveActivityState,
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
  const data: Record<string, string> = {
    kind: message.target.kind,
    reference: message.target.reference ?? "",
    ...(message.target.documentType ? { document_type: message.target.documentType } : {}),
  };
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

const LIVE = "mobile_live_activities";

export type LivePlatform = "ios" | "android";

function liveId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Registers a shipment the customer follows on their lock screen, with what
 * FCM needs to move it: on iOS a Live Activity and its APNs push token, on
 * Android the app's own ongoing notification, identified by an id the app
 * chose, moved by a data message the app handles itself. */
export async function saveLiveActivity(input: {
  email: string;
  customerId: string;
  shipmentReference: string;
  activityToken: string;
  fcmToken: string;
  platform: LivePlatform;
}) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  await firebaseAdminDb().collection(LIVE).doc(liveId(input.activityToken)).set({
    email: input.email.trim().toLowerCase(),
    customer_id: input.customerId,
    shipment_reference: input.shipmentReference,
    activity_token: input.activityToken,
    fcm_token: input.fcmToken,
    platform: input.platform,
    updated_at: new Date().toISOString(),
  });
  return { kind: "saved" as const };
}

/** Forgets an activity, but only the caller's own. */
export async function deleteLiveActivity(email: string, activityToken: string) {
  if (!firebaseRuntimeConfigured()) return;
  const reference = firebaseAdminDb().collection(LIVE).doc(liveId(activityToken));
  const snapshot = await reference.get();
  if (snapshot.exists && snapshot.get("email") === email.trim().toLowerCase()) await reference.delete();
}

/**
 * Brings a person's Live Activities for a shipment up to date, and ends them
 * once it is delivered. Never throws: a lock screen that lags must not cost
 * the notification that carries the same news.
 */
export async function refreshLiveActivities(
  email: string,
  shipmentReference: string,
  state: (shipment: Record<string, unknown>) => LiveActivityState,
) {
  if (!firebaseRuntimeConfigured()) return;
  try {
    const db = firebaseAdminDb();
    const [activities, shipment] = await Promise.all([
      db.collection(LIVE).where("email", "==", email.trim().toLowerCase()).where("shipment_reference", "==", shipmentReference).limit(10).get(),
      db.collection("shipments").doc(shipmentReference).get(),
    ]);
    if (activities.empty || !shipment.exists) return;
    const data = shipment.data() as Record<string, unknown>;
    // The activity was started for this customer's shipment; if it has moved
    // to another customer since, it is no longer theirs to follow.
    const owner = String(data.customer_id ?? "");
    const ends = liveActivityEnds(data);
    const now = Math.floor(Date.now() / 1000);
    for (const activity of activities.docs) {
      if (String(activity.get("customer_id") ?? "") !== owner) {
        await activity.ref.delete();
        continue;
      }
      try {
        const token = String(activity.get("fcm_token"));
        if (activity.get("platform") === "android") {
          // Data only, at high priority: the app moves its own notification,
          // even when it isn't running, and nothing is shown twice.
          await firebaseAdminMessaging().send({ token, data: androidLiveData(shipmentReference, state(data), ends), android: { priority: "high", ttl: 6 * 60 * 60 * 1000 } });
          if (ends) await activity.ref.delete();
          continue;
        }
        await firebaseAdminMessaging().send({
          token,
          apns: {
            liveActivityToken: String(activity.get("activity_token")),
            headers: { "apns-priority": "10" },
            payload: {
              aps: {
                timestamp: now,
                event: ends ? "end" : "update",
                "content-state": state(data),
                ...(ends ? { "dismissal-date": now + 4 * 60 * 60 } : {}),
              },
            },
          },
        });
        if (ends) await activity.ref.delete();
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (mobilePushTokenDead(code)) await activity.ref.delete();
      }
    }
  } catch (error) {
    console.error("KCPL live activity refresh failed", error);
  }
}
