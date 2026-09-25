import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { createDirectNotification } from "../admin/notifications/notification-centre.server";
import type { PortalSession } from "./portal-auth";
import { portalOwnsShipment } from "./portal-data.server";
import { portalWriteRefused, type PortalWriteResult } from "./portal-intake";
import {
  deliveryRatable,
  deliveryRatingFromBody,
  deliveryRatingIsComplaint,
  deliveryReviewUrl,
} from "./portal-delivery-rating";

/*
 * The delivery rating, shared by the web portal and the KCPL app. Stored as
 * shipments/{ref}/customer_feedback/{hash of the login}, so each login rates
 * a shipment once. It never writes the shipment document.
 */

function feedbackRef(reference: string, email: string) {
  const id = createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
  return firebaseAdminDb().collection("shipments").doc(reference).collection("customer_feedback").doc(id);
}

/** Whether this login has rated the shipment, and with what. */
export async function portalDeliveryRating(session: PortalSession, reference: string) {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await feedbackRef(reference.trim().toUpperCase(), session.email).get();
  if (!snapshot.exists) return null;
  return { score: Number(snapshot.get("score")), created_at: String(snapshot.get("created_at") ?? "") };
}

export async function ratePortalDelivery(session: PortalSession, reference: string, body: Record<string, unknown>, source: "customer_portal" | "customer_app"): Promise<PortalWriteResult> {
  if (!firebaseRuntimeConfigured()) return portalWriteRefused(503, "unavailable", "Ratings are not available just now.");
  const rating = deliveryRatingFromBody(body);
  if (!rating) return portalWriteRefused(400, "invalid", "Choose from one to five.");
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return portalWriteRefused(404, "missing", "Shipment not found.");
  const shipment = await firebaseAdminDb().collection("shipments").doc(normalized).get();
  if (!deliveryRatable(String(shipment.get("status") ?? ""))) return portalWriteRefused(409, "conflict", "This shipment can be rated once it is delivered.");

  const ref = feedbackRef(normalized, session.email);
  try {
    await ref.create({
      score: rating.score,
      comment: rating.comment || null,
      email: session.email,
      name: session.displayName || null,
      customer_id: session.customerId,
      customer_name: session.customerName,
      source,
      created_at: new Date().toISOString(),
    });
  } catch {
    return portalWriteRefused(409, "conflict", "You have already rated this delivery.");
  }

  const complaint = deliveryRatingIsComplaint(rating.score);
  if (complaint) await tellDesk(normalized, session, rating.score, rating.comment, shipment);
  return {
    status: 201,
    body: {
      ok: true,
      complaint,
      // Only a happy customer is asked for a public review.
      reviewUrl: complaint ? null : deliveryReviewUrl(),
      message: complaint ? "Thank you. The team that handled this delivery will be in touch." : "Thank you for telling us.",
    },
  };
}

async function tellDesk(reference: string, session: PortalSession, score: number, comment: string, shipment: FirebaseFirestore.DocumentSnapshot) {
  try {
    const targetEmail = typeof shipment.get("job_assigned_to_email") === "string" ? String(shipment.get("job_assigned_to_email")) : "";
    if (!targetEmail.trim()) return;
    await createDirectNotification({
      targetEmail,
      targetName: typeof shipment.get("job_assigned_to_name") === "string" ? String(shipment.get("job_assigned_to_name")) : null,
      category: "shipments",
      severity: score <= 2 ? "critical" : "warning",
      title: `${session.customerName} rated the delivery of ${reference} ${score}/5`,
      detail: comment || "No comment was left. Call the customer to find out what went wrong.",
      actionPath: `/admin/jobs/${encodeURIComponent(reference)}#messages`,
      parentReference: reference,
      sourceType: "operational",
      sourceId: `rating:${reference}`,
    });
  } catch (error) {
    console.error("KCPL rating notification failed", error);
  }
}
