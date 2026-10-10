import { firebaseAdminDb } from "../firebase-admin.server";
import { nepalOperationalDate } from "../invoice-effective-status";
import { createCargoClaim, withdrawCustomerClaim, type ClaimPhoto } from "../cargo-claims.server";
import { CARGO_CLAIMS, CLAIM_MAX_PHOTOS, claimFromRecord, claimReportFromInput, portalClaimView, type PortalClaimView } from "../cargo-claims";
import { validateShipmentDocumentBytes } from "../shipment-document-policy";
import type { PortalSession } from "./portal-auth";
import { PORTAL_UPLOAD_MAX_BYTES } from "./portal-access-policy";
import { admitPortalDocument } from "./portal-document-intake.server";
import { portalOwnsShipment } from "./portal-data.server";
import { portalIntakeExtension, portalWriteRefused, type PortalWriteResult } from "./portal-intake";

/*
 * A customer reports damage, shortage, loss or delay, from the web portal or
 * the KCPL app. The same checks as a document upload come first (the account
 * may send, the shipment is theirs, the rate limit); photos are sniffed the
 * same way. The claim itself is createCargoClaim's, as for staff.
 */

const PHOTO_TYPES: Readonly<Record<string, string>> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

const errors: Record<string, string> = {
  kind: "Choose what happened: damage, shortage, loss, delay or something else.",
  description: "Say what happened in a sentence or two, so KCPL can take it up.",
  date: "Enter the day you found the problem, not a future date.",
  amount: "Enter the value as a number, or leave it blank.",
};

export async function receivePortalClaim(session: PortalSession, reference: string, request: Request): Promise<PortalWriteResult> {
  const admitted = await admitPortalDocument(session, reference, "This account can view shipments but cannot report a claim.");
  if ("status" in admitted) return admitted;
  let form: FormData;
  try { form = await request.formData(); } catch { return portalWriteRefused(400, "invalid", "The claim could not be read."); }
  const field = (key: string) => typeof form.get(key) === "string" ? form.get(key) as string : "";
  const checked = claimReportFromInput({ kind: field("kind"), description: field("description"), noticedOn: field("noticedOn"), claimedAmount: field("claimedAmount"), currency: field("currency") }, nepalOperationalDate());
  if (!checked.ok) return portalWriteRefused(400, "invalid", errors[checked.error]);

  const files = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > CLAIM_MAX_PHOTOS) return portalWriteRefused(400, "invalid", `Send up to ${CLAIM_MAX_PHOTOS} photos.`);
  const photos: ClaimPhoto[] = [];
  for (const file of files) {
    const ext = portalIntakeExtension(file.name);
    const contentType = PHOTO_TYPES[ext];
    if (!contentType) return portalWriteRefused(415, "unsupported", "Send photos as JPEG, PNG or WEBP, or a PDF.");
    if (file.size > PORTAL_UPLOAD_MAX_BYTES) return portalWriteRefused(413, "too_large", `Each photo must be ${Math.floor(PORTAL_UPLOAD_MAX_BYTES / (1024 * 1024))} MB or smaller.`);
    const data = await file.arrayBuffer();
    const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
    if (signatureError) return portalWriteRefused(415, "unsupported", signatureError);
    photos.push({ filename: file.name, contentType, data });
  }

  try {
    const result = await createCargoClaim(admitted.normalized, checked.value, photos, { name: session.customerName, email: session.email, source: "customer" });
    if (result.kind === "missing") return portalWriteRefused(404, "missing", "Shipment not found.");
    return { status: 201, body: { ok: true, number: result.number, photos: result.photos, message: `Claim ${result.number} sent to KCPL. The team will take it up with the carrier or insurer and keep you posted here.` } };
  } catch (error) {
    console.error("KCPL portal claim failed", error);
    return portalWriteRefused(500, "failed", "The claim could not be sent. Try again.");
  }
}

/** The customer's claims on one shipment. */
export async function listPortalClaims(session: PortalSession, reference: string): Promise<PortalClaimView[] | null> {
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return null;
  try {
    const snapshot = await firebaseAdminDb().collection(CARGO_CLAIMS).where("shipment_reference", "==", normalized).limit(50).get();
    return snapshot.docs
      .map((doc) => claimFromRecord(doc.id, doc.data() as Record<string, unknown>))
      .filter((claim) => claim.customer_id === session.customerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(portalClaimView);
  } catch (error) {
    console.error("KCPL portal claims read failed", error);
    return null;
  }
}

export async function withdrawPortalClaim(session: PortalSession, reference: string, id: string): Promise<PortalWriteResult> {
  if (!session.capabilities.canSubmitRequests) return portalWriteRefused(403, "forbidden", "This account can view shipments but cannot change a claim.");
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return portalWriteRefused(404, "missing", "Shipment not found.");
  const result = await withdrawCustomerClaim(session.customerId, normalized, id, { name: session.customerName, email: session.email });
  if (result.kind === "missing") return portalWriteRefused(404, "missing", "Claim not found.");
  if (result.kind === "invalid_status") return portalWriteRefused(409, "conflict", "KCPL has already taken this claim up, so it can't be withdrawn here. Send KCPL a message instead.");
  return { status: 200, body: { ok: true } };
}
