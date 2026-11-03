import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import type { PartnerSession } from "./partner-auth";

/*
 * Partner-facing notifications. These are the portal's own inbox, separate
 * from staff notifications: a partner must never see a customer, a margin or
 * an internal alert. Each item carries only a title, a short detail and a
 * route inside /partner.
 */

export type PartnerNotification = {
  id: string;
  type: string;
  title: string;
  detail: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

export type PartnerNotificationInput = {
  partnerId: string;
  type: "tender" | "tender_reminder" | "shipment" | "bill";
  title: string;
  detail: string;
  href: string;
  dedupeKey: string;
};

function notificationId(partnerId: string, dedupeKey: string) {
  return createHash("sha256").update(`${partnerId.trim().toUpperCase()}:${dedupeKey}`).digest("hex").slice(0, 40);
}

export async function createPartnerNotification(input: PartnerNotificationInput) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const id = notificationId(input.partnerId, input.dedupeKey);
  const now = new Date().toISOString();
  try {
    const ref = firebaseAdminDb().collection("partner_notifications").doc(id);
    const outcome = await firebaseAdminDb().runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists) return "existing" as const;
      transaction.set(ref, {
        partner_id: input.partnerId.trim().toUpperCase(),
        type: input.type,
        title: input.title.slice(0, 180),
        detail: input.detail.slice(0, 600),
        href: input.href.startsWith("/partner") ? input.href.slice(0, 300) : "/partner",
        created_at: now,
        read_at: null,
      });
      return "created" as const;
    });
    return { kind: outcome, id };
  } catch (error) {
    console.error("KCPL partner notification failed", error);
    return { kind: "unavailable" as const };
  }
}

export async function listPartnerNotifications(session: PartnerSession, limit = 50): Promise<PartnerNotification[]> {
  if (!firebaseRuntimeConfigured()) return [];
  try {
    const snapshot = await firebaseAdminDb().collection("partner_notifications")
      .where("partner_id", "==", session.partnerId.trim().toUpperCase())
      .limit(Math.min(200, Math.max(1, limit)))
      .get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      type: String(doc.get("type") ?? "tender"),
      title: String(doc.get("title") ?? ""),
      detail: String(doc.get("detail") ?? ""),
      href: String(doc.get("href") ?? "/partner"),
      created_at: String(doc.get("created_at") ?? ""),
      read_at: typeof doc.get("read_at") === "string" ? doc.get("read_at") as string : null,
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    console.error("KCPL partner notification listing failed", error);
    return [];
  }
}

/** Opening a tender clears both the "new" and the "due soon" alert for it. */
export async function markTenderNotificationRead(session: PartnerSession, tenderId: string) {
  if (!firebaseRuntimeConfigured()) return;
  const db = firebaseAdminDb();
  const now = new Date().toISOString();
  const ids = [
    notificationId(session.partnerId, `tender-sent:${tenderId}`),
    notificationId(session.partnerId, `tender-reminder:${tenderId}`),
  ];
  await Promise.all(ids.map((id) => db.collection("partner_notifications").doc(id).update({ read_at: now }).catch(() => undefined)));
}

export async function markPartnerNotificationRead(session: PartnerSession, id: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("partner_notifications").doc(id.trim());
  const snapshot = await ref.get();
  if (!snapshot.exists || String(snapshot.get("partner_id") ?? "") !== session.partnerId.trim().toUpperCase()) return { kind: "missing" as const };
  if (!snapshot.get("read_at")) await ref.update({ read_at: new Date().toISOString() }).catch(() => undefined);
  return { kind: "updated" as const };
}
