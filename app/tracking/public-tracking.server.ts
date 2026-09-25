import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import type { PortalSession } from "../portal/portal-auth";
import { portalOwnsShipment } from "../portal/portal-data.server";
import { checkPortalRequestRateLimit } from "../portal/portal-requests.server";
import {
  newTrackingToken,
  publicTrackingView,
  TRACKING_LINK_DAYS,
  trackingLinkLive,
  trackingTokenHash,
  trackingTokenShapeValid,
  type PublicTrackingView,
} from "./public-tracking";

const LINKS = "tracking_links";

type Result = { status: number; body: Record<string, unknown> };

/** A new link for one of the customer's own shipments, for a login that may
 * act for the company. The token is returned once and never stored. */
export async function createTrackingLink(session: PortalSession, reference: string, origin: string): Promise<Result> {
  if (!session.capabilities.canSubmitRequests) {
    return { status: 403, body: { ok: false, code: "forbidden", error: "This account can view shipments but cannot share them." } };
  }
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return { status: 404, body: { ok: false, code: "missing", error: "Shipment not found." } };
  const limit = await checkPortalRequestRateLimit(session);
  if (!limit.allowed) return { status: 429, body: { ok: false, code: "rate_limited", error: "Too many links just now. Please try again shortly." } };

  const token = newTrackingToken();
  const now = new Date();
  const expires = new Date(now.getTime() + TRACKING_LINK_DAYS * 24 * 60 * 60 * 1000);
  await firebaseAdminDb().collection(LINKS).doc(trackingTokenHash(token)).create({
    shipment_reference: normalized,
    customer_id: session.customerId,
    created_by_email: session.email,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    revoked_at: null,
  });
  return { status: 201, body: { ok: true, url: `${origin}/t/${token}`, expires_at: expires.toISOString() } };
}

/** Withdraws every link this customer made for the shipment. */
export async function revokeTrackingLinks(session: PortalSession, reference: string): Promise<Result> {
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return { status: 404, body: { ok: false, code: "missing", error: "Shipment not found." } };
  const db = firebaseAdminDb();
  const links = await db.collection(LINKS)
    .where("shipment_reference", "==", normalized)
    .where("customer_id", "==", session.customerId)
    .limit(100)
    .get();
  const now = new Date().toISOString();
  const batch = db.batch();
  let revoked = 0;
  for (const link of links.docs) {
    if (link.get("revoked_at")) continue;
    batch.update(link.ref, { revoked_at: now, revoked_by_email: session.email });
    revoked++;
  }
  if (revoked) await batch.commit();
  return { status: 200, body: { ok: true, revoked } };
}

/** What a tracking link shows, or null for a link that is malformed,
 * unknown, expired or withdrawn: all four look the same from outside. */
export async function readPublicTracking(token: string): Promise<PublicTrackingView | null> {
  if (!trackingTokenShapeValid(token) || !firebaseRuntimeConfigured()) return null;
  try {
    const db = firebaseAdminDb();
    const link = await db.collection(LINKS).doc(trackingTokenHash(token)).get();
    if (!link.exists || !trackingLinkLive(link.data())) return null;
    const reference = String(link.get("shipment_reference") ?? "");
    const shipment = await db.collection("shipments").doc(reference).get();
    // The link was made for this customer's shipment; if the shipment has
    // since moved to another customer, the link no longer shows it.
    if (!shipment.exists || String(shipment.get("customer_id") ?? "") !== String(link.get("customer_id") ?? "")) return null;
    const events = await shipment.ref.collection("events").orderBy("event_time", "desc").limit(20).get();
    return publicTrackingView(reference, shipment.data() as Record<string, unknown>, events.docs.map((event) => event.data() as Record<string, unknown>));
  } catch (error) {
    console.error("KCPL public tracking read failed", error);
    return null;
  }
}
