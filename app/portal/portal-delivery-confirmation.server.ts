import { createDirectNotification } from "../admin/notifications/notification-centre.server";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import type { PortalSession } from "./portal-auth";
import { portalConfirmableDeliveryStatus } from "./portal-access-policy";
import { portalWriteRefused, type PortalWriteResult } from "./portal-intake";

/*
 * Customer confirmation of receipt, from the web portal or the KCPL app.
 *
 * This is evidence, never authority. Canonical Delivered is written by the
 * delivery authority from a verified POD, and nothing here touches that path:
 * the confirmation lands in its own `customer_confirmations` subcollection and
 * on the Job File activity, and this module writes no shipment status, no
 * delivery attempt and no POD evidence. A customer saying "it arrived" is
 * useful context for the operator closing the file -- it is not a substitute
 * for the proof the workflow requires, and treating it as one would put a
 * customer inside KCPL's delivery authority.
 */

export type PortalDoor = "customer_portal" | "customer_app";

export async function confirmPortalDelivery(
  session: PortalSession,
  reference: string,
  body: Record<string, unknown>,
  source: PortalDoor,
): Promise<PortalWriteResult> {
  // The portal shows the confirmation only to logins that can send things to
  // KCPL; the rule is enforced here so neither door depends on a hidden button.
  if (!session.capabilities.canSubmitRequests) {
    return portalWriteRefused(403, "forbidden", "This account can view shipments but cannot confirm deliveries.");
  }
  const normalized = reference.trim().toUpperCase();
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const receivedBy = typeof body.receivedBy === "string" ? body.receivedBy.trim().slice(0, 120) : "";

  if (!firebaseRuntimeConfigured()) return portalWriteRefused(503, "unavailable", "Shipment storage is unavailable.");

  try {
    const db = firebaseAdminDb();
    const shipmentRef = db.collection("shipments").doc(normalized);
    const snapshot = await shipmentRef.get();
    // Ownership from the session, and a shipment that is not theirs reads as
    // missing rather than forbidden.
    if (!snapshot.exists || String(snapshot.get("customer_id") ?? "") !== session.customerId) {
      return portalWriteRefused(404, "missing", "Shipment not found.");
    }

    const status = String(snapshot.get("status") ?? "");
    if (!portalConfirmableDeliveryStatus(status)) {
      return portalWriteRefused(409, "conflict", "This shipment has not reached delivery yet.");
    }

    const now = new Date().toISOString();
    // One confirmation per shipment per account: a deterministic id makes a
    // double-submit idempotent instead of stacking duplicates on the Job File.
    const confirmationId = `${session.email.replace(/[^a-z0-9]+/gi, "-")}`.slice(0, 120);
    const confirmationRef = shipmentRef.collection("customer_confirmations").doc(confirmationId);
    if ((await confirmationRef.get()).exists) {
      return { status: 200, body: { ok: true, alreadyConfirmed: true, message: "You have already confirmed receipt of this shipment." } };
    }

    const batch = db.batch();
    batch.create(confirmationRef, {
      shipment_reference: normalized,
      customer_id: session.customerId,
      confirmed_by_email: session.email,
      confirmed_by_name: session.displayName,
      received_by: receivedBy || null,
      note: note || null,
      shipment_status_at_confirmation: status,
      source,
      created_at: now,
    });
    batch.create(shipmentRef.collection("job_activity").doc(`customer-confirmation-${Date.now()}`), {
      type: "customer_confirmed_delivery",
      title: "Customer confirmed receipt",
      detail: [receivedBy ? `Received by ${receivedBy}` : "", note].filter(Boolean).join(" · ") || null,
      actor_name: session.customerName,
      actor_email: session.email,
      created_at: now,
    });
    await batch.commit();

    await notifyOperator(normalized, session.customerName, receivedBy, snapshot);

    return { status: 201, body: { ok: true, message: "Thank you. KCPL has been told the cargo arrived." } };
  } catch (error) {
    console.error("KCPL portal delivery confirmation failed", error);
    return portalWriteRefused(500, "failed", "The confirmation could not be saved.");
  }
}

async function notifyOperator(
  reference: string,
  customerName: string,
  receivedBy: string,
  snapshot: FirebaseFirestore.DocumentSnapshot,
) {
  try {
    const targetEmail = typeof snapshot.get("job_assigned_to_email") === "string"
      ? snapshot.get("job_assigned_to_email") as string
      : "";
    if (!targetEmail.trim()) return;
    await createDirectNotification({
      targetEmail,
      targetName: typeof snapshot.get("job_assigned_to_name") === "string" ? snapshot.get("job_assigned_to_name") as string : null,
      category: "shipments",
      severity: "info",
      title: `${customerName} confirmed receipt`,
      detail: receivedBy
        ? `Received by ${receivedBy}. Customer confirmation is not a POD -- verified evidence is still required to close ${reference}.`
        : `Customer confirmation is not a POD -- verified evidence is still required to close ${reference}.`,
      actionPath: `/admin/jobs/${encodeURIComponent(reference)}#delivery-pod`,
      parentReference: reference,
      sourceType: "operational",
      sourceId: reference,
    });
  } catch (error) {
    // A confirmation that was stored must not fail because the nudge did not send.
    console.error("KCPL delivery confirmation notification failed", error);
  }
}
