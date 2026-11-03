import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { createPartnerNotification } from "../../partner/partner-notifications.server";

/*
 * A tender reminder is a portal notification with a deterministic id, not an
 * email campaign. The automation run can retry safely: the same tender produces
 * the same notification id, so a reminder is never stacked.
 *
 * Only tenders still awaiting a response inside the next 24 hours are selected.
 * Expiry handling remains the tender expiry sweep's job.
 */

export async function dispatchTenderReminders(now = new Date()) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, created: 0 };
  try {
    const snapshot = await firebaseAdminDb().collection("transport_tenders")
      .where("status", "==", "sent")
      .limit(500)
      .get();
    const horizon = now.getTime() + 24 * 60 * 60 * 1000;
    let created = 0;
    for (const doc of snapshot.docs) {
      const due = Date.parse(String(doc.get("response_due_at") ?? ""));
      if (!Number.isFinite(due) || due <= now.getTime() || due > horizon) continue;
      const partnerId = String(doc.get("partner_id") ?? "").trim().toUpperCase();
      if (!partnerId) continue;
      const result = await createPartnerNotification({
        partnerId,
        type: "tender_reminder",
        title: "Tender response due soon",
        detail: `${doc.get("tender_reference") || doc.id} · ${doc.get("origin") || "Origin"} → ${doc.get("destination") || "Destination"} · due ${new Date(due).toISOString()}`,
        href: `/partner/tenders/${encodeURIComponent(doc.id)}`,
        dedupeKey: `tender-reminder:${doc.id}`,
      }).catch(() => ({ kind: "unavailable" as const }));
      if (result.kind === "created") created += 1;
    }
    return { kind: "ready" as const, created };
  } catch (error) {
    console.error("KCPL tender reminder sweep failed", error);
    return { kind: "unavailable" as const, created: 0 };
  }
}
