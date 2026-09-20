import { createDirectNotification } from "../../../../../admin/notifications/notification-centre.server";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../../../firebase-admin.server";
import { getPortalAccess } from "../../../../../portal/portal-auth";
import { portalConfirmableDeliveryStatus } from "../../../../../portal/portal-access-policy";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

/*
 * Customer confirmation of receipt.
 *
 * This is evidence, never authority. Canonical Delivered is written by the
 * delivery authority from a verified POD, and nothing here touches that path:
 * the confirmation lands in its own `customer_confirmations` subcollection and
 * on the Job File activity, and the route writes no shipment status, no
 * delivery attempt and no POD evidence. A customer saying "it arrived" is
 * useful context for the operator closing the file -- it is not a substitute
 * for the proof the workflow requires, and treating it as one would put a
 * customer inside KCPL's delivery authority.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin confirmations are not accepted." }, 403);

  const { reference } = await context.params;
  const normalized = reference.trim().toUpperCase();

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The confirmation could not be read." }, 400);
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const receivedBy = typeof body.receivedBy === "string" ? body.receivedBy.trim().slice(0, 120) : "";

  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Shipment storage is unavailable." }, 503);

  try {
    const db = firebaseAdminDb();
    const shipmentRef = db.collection("shipments").doc(normalized);
    const snapshot = await shipmentRef.get();
    // Ownership from the session, and a shipment that is not theirs reads as
    // missing rather than forbidden.
    if (!snapshot.exists || String(snapshot.get("customer_id") ?? "") !== access.session.customerId) {
      return json({ ok: false, error: "Shipment not found." }, 404);
    }

    const status = String(snapshot.get("status") ?? "");
    if (!portalConfirmableDeliveryStatus(status)) {
      return json({ ok: false, error: "This shipment has not reached delivery yet." }, 409);
    }

    const now = new Date().toISOString();
    // One confirmation per shipment per account: a deterministic id makes a
    // double-submit idempotent instead of stacking duplicates on the Job File.
    const confirmationId = `${access.session.email.replace(/[^a-z0-9]+/gi, "-")}`.slice(0, 120);
    const confirmationRef = shipmentRef.collection("customer_confirmations").doc(confirmationId);
    if ((await confirmationRef.get()).exists) {
      return json({ ok: true, alreadyConfirmed: true, message: "You have already confirmed receipt of this shipment." });
    }

    const batch = db.batch();
    batch.create(confirmationRef, {
      shipment_reference: normalized,
      customer_id: access.session.customerId,
      confirmed_by_email: access.session.email,
      confirmed_by_name: access.session.displayName,
      received_by: receivedBy || null,
      note: note || null,
      shipment_status_at_confirmation: status,
      source: "customer_portal",
      created_at: now,
    });
    batch.create(shipmentRef.collection("job_activity").doc(`customer-confirmation-${Date.now()}`), {
      type: "customer_confirmed_delivery",
      title: "Customer confirmed receipt",
      detail: [receivedBy ? `Received by ${receivedBy}` : "", note].filter(Boolean).join(" · ") || null,
      actor_name: access.session.customerName,
      actor_email: access.session.email,
      created_at: now,
    });
    await batch.commit();

    await notifyOperator(normalized, access.session.customerName, receivedBy, snapshot);

    return json({ ok: true, message: "Thank you. KCPL has been told the cargo arrived." }, 201);
  } catch (error) {
    console.error("KCPL portal delivery confirmation failed", error);
    return json({ ok: false, error: "The confirmation could not be saved." }, 500);
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
