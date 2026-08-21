import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";

function text(value: unknown) { return typeof value === "string" ? value : ""; }

export async function reconcileExpiredTmsTenders() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, expired: 0 };
  const db = firebaseAdminDb();
  const now = new Date().toISOString();
  const snapshot = await db.collection("transport_tenders").where("status", "==", "sent").limit(500).get();
  const expired = snapshot.docs.filter((doc) => {
    const due = text(doc.get("response_due_at"));
    return Boolean(due && due <= now);
  });

  let reconciled = 0;
  for (const tenderDoc of expired) {
    const changed = await db.runTransaction(async (transaction) => {
      const freshTender = await transaction.get(tenderDoc.ref);
      if (!freshTender.exists || freshTender.get("status") !== "sent") return false;
      const due = text(freshTender.get("response_due_at"));
      if (!due || due > now) return false;
      const orderId = text(freshTender.get("order_id")).trim().toUpperCase();
      if (!orderId) {
        transaction.update(tenderDoc.ref, { status: "expired", updated_at: now });
        return true;
      }

      const orderRef = db.collection("transport_orders").doc(orderId);
      const order = await transaction.get(orderRef);
      transaction.update(tenderDoc.ref, { status: "expired", updated_at: now });
      if (order.exists && text(order.get("active_tender_id")) === tenderDoc.id && order.get("status") === "tendering") {
        transaction.update(orderRef, { status: "selected", active_tender_id: null, updated_at: now });
        transaction.create(orderRef.collection("events").doc(`evt-${crypto.randomUUID()}`), {
          type: "tender_expired",
          title: `Tender expired: ${text(freshTender.get("tender_reference")) || tenderDoc.id}`,
          detail: `No response was recorded by ${due}. The order is available for re-tendering.`,
          actor_name: "KCPL Tender Desk",
          actor_email: null,
          created_at: now,
        });
      }
      return true;
    });
    if (changed) reconciled += 1;
  }
  return { kind: "ready" as const, expired: reconciled };
}
