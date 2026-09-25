import { firebaseAdminBucket, firebaseAdminDb, firebaseRuntimeConfigured, firebaseStorageBucketName } from "../firebase-admin.server";
import type { PortalSession } from "./portal-auth";
import { portalOwnsShipment } from "./portal-data.server";
import { portalPodContentType, portalPodEvidenceVisible, portalProofOfDeliveryView, type PortalProofOfDelivery } from "./portal-proof-of-delivery";

/*
 * Proof of delivery for the customer: the web portal's shipment page and the
 * KCPL app. Read-only. Only what KCPL has verified, and marked safe to share
 * when verifying, is shown; the driver's copy of a delivery nobody has checked
 * yet stays with the desk. Each file is served only after the same gates, and
 * someone else's shipment reads as missing.
 */

function shipment(reference: string) {
  return firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase());
}

export async function portalProofOfDelivery(session: PortalSession, reference: string): Promise<PortalProofOfDelivery | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return null;
  try {
    const ref = shipment(normalized);
    const record = await ref.get();
    if (!record.exists || record.get("delivery_pod_status") !== "verified") return null;
    const [evidence, attempts] = await Promise.all([
      ref.collection("pod_evidence").limit(100).get(),
      ref.collection("delivery_attempts").limit(50).get(),
    ]);
    return portalProofOfDeliveryView({
      shipment: record.data() as Record<string, unknown>,
      evidence: evidence.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })),
      attempts: attempts.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })),
    });
  } catch (error) {
    console.error("KCPL portal proof of delivery read failed", error);
    return null;
  }
}

export type PortalPodFile =
  | { kind: "ready"; bytes: Buffer; contentType: string; filename: string }
  | { kind: "missing" }
  | { kind: "unavailable" };

export async function portalProofOfDeliveryFile(session: PortalSession, reference: string, evidenceId: string): Promise<PortalPodFile> {
  if (!firebaseRuntimeConfigured() || !firebaseStorageBucketName()) return { kind: "unavailable" };
  const normalized = reference.trim().toUpperCase();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(evidenceId)) return { kind: "missing" };
  if (!await portalOwnsShipment(session, normalized)) return { kind: "missing" };
  const ref = shipment(normalized);
  const [record, evidence] = await Promise.all([ref.get(), ref.collection("pod_evidence").doc(evidenceId).get()]);
  if (!record.exists || record.get("delivery_pod_status") !== "verified" || !evidence.exists) return { kind: "missing" };
  const data = evidence.data() as Record<string, unknown>;
  if (!portalPodEvidenceVisible(data)) return { kind: "missing" };
  const path = typeof data.storage_path === "string" ? data.storage_path : "";
  if (!path) return { kind: "missing" };
  try {
    const [bytes] = await firebaseAdminBucket().file(path).download();
    return {
      kind: "ready",
      bytes,
      contentType: portalPodContentType(data.content_type),
      filename: typeof data.filename === "string" && data.filename ? data.filename : `${normalized}-proof-of-delivery`,
    };
  } catch (error) {
    console.error("KCPL portal proof of delivery file failed", error);
    return { kind: "unavailable" };
  }
}
