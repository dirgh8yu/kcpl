import { firebaseAdminDb } from "../firebase-admin.server";
import { addShipmentEvent } from "../shipment-data.server";
import { uploadShipmentDocument } from "../shipment-documents.server";
import { shipmentDocumentTypes, type ShipmentDocumentType } from "../shipment-document-types";
import { readAllDocuments } from "../admin/firestore-scan";
import { checkQuoteRateLimit, quoteRateLimitPolicies } from "../api/quotes/quote-rate-limit-policy";
import { firestoreQuoteRateLimitStore } from "../api/quotes/quote-rate-limit.server";
import { validateShipmentDocumentBytes } from "../shipment-document-policy";
import type { PartnerSession } from "./partner-auth";
import { partnerCanSeeShipment, partnerShipmentAccessFromRecord, partnerShipmentRoleLabels } from "./partner-access-policy";

/*
 * What a partner reads and writes. Every function takes the partner session
 * and checks the shipment lists that partner before reading anything from it.
 * Partners see the route, status and milestones, and the documents they sent
 * themselves; never the customer's documents, prices or KCPL's notes.
 */

function text(value: unknown) { return typeof value === "string" ? value : ""; }

export type PartnerShipmentRow = {
  reference: string; origin: string; destination: string; mode: string; status: string; eta: string | null;
  carrier_reference: string | null; role: string; updated_at: string;
};

function rowFromData(reference: string, data: Record<string, unknown>, partnerId: string): PartnerShipmentRow {
  const access = partnerShipmentAccessFromRecord(data.partner_access).find((item) => item.partner_id === partnerId);
  return {
    reference, origin: text(data.origin), destination: text(data.destination), mode: text(data.mode), status: text(data.status),
    eta: text(data.eta) || null, carrier_reference: text(data.carrier_reference) || null,
    role: access ? partnerShipmentRoleLabels[access.role] : "Partner", updated_at: text(data.updated_at),
  };
}

export async function listPartnerShipments(session: PartnerSession) {
  const snapshot = await readAllDocuments(firebaseAdminDb().collection("shipments").where("partner_access_ids", "array-contains", session.partnerId));
  return snapshot.docs
    .filter((doc) => partnerCanSeeShipment(doc.data() as Record<string, unknown>, session.partnerId))
    .map((doc) => rowFromData(doc.id, doc.data() as Record<string, unknown>, session.partnerId))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getPartnerShipment(session: PartnerSession, reference: string) {
  const normalized = reference.trim().toUpperCase();
  const db = firebaseAdminDb();
  const doc = await db.collection("shipments").doc(normalized).get();
  // Not on this partner's list reads as missing, so a reference can't be probed.
  if (!doc.exists || !partnerCanSeeShipment(doc.data() as Record<string, unknown>, session.partnerId)) return null;
  const [events, documents] = await Promise.all([
    doc.ref.collection("events").orderBy("event_time", "desc").limit(100).get(),
    doc.ref.collection("documents").where("uploaded_by_partner_id", "==", session.partnerId).limit(100).get(),
  ]);
  return {
    shipment: rowFromData(normalized, doc.data() as Record<string, unknown>, session.partnerId),
    events: events.docs.map((event) => ({ id: event.id, title: text(event.get("title")), location: text(event.get("location")) || null, details: text(event.get("details")) || null, event_time: text(event.get("event_time")), author_name: text(event.get("author_name")) })),
    // Their invoices are listed with the bills, not as documents.
    documents: documents.docs.filter((item) => item.get("review_status") !== "deleted" && item.get("kcpl_only") !== true).map((item) => ({ id: item.id, filename: text(item.get("filename")), document_type: text(item.get("document_type")), uploaded_at: text(item.get("uploaded_at")), review_status: text(item.get("review_status")) })),
  };
}

/** A milestone from the partner: shown on the shipment's milestones, marked as theirs, and in KCPL's history. */
export async function postPartnerMilestone(session: PartnerSession, reference: string, input: { title: string; location: string; details: string; eventTime: string }) {
  const normalized = reference.trim().toUpperCase();
  const db = firebaseAdminDb();
  const doc = await db.collection("shipments").doc(normalized).get();
  if (!doc.exists || !partnerCanSeeShipment(doc.data() as Record<string, unknown>, session.partnerId)) return { kind: "missing" as const };
  const title = input.title.trim().slice(0, 120);
  if (title.length < 3) return { kind: "title_required" as const };
  const eventTime = input.eventTime.trim();
  if (eventTime && (Number.isNaN(Date.parse(eventTime)) || Date.parse(eventTime) > Date.now() + 60 * 60 * 1000)) return { kind: "invalid_time" as const };
  const result = await addShipmentEvent(normalized, {
    title, location: input.location.trim().slice(0, 180), details: input.details.trim().slice(0, 600), eventTime: eventTime ? new Date(eventTime).toISOString() : "",
  }, `${session.partnerName} (partner)`);
  if (result.kind !== "created") return { kind: "unavailable" as const };
  await doc.ref.collection("job_activity").doc(`partner-update-${Date.now()}`).create({
    type: "partner_milestone", title: `${session.partnerName}: ${title}`, detail: input.location.trim() || null,
    actor_name: `${session.displayName} at ${session.partnerName}`, actor_email: session.email, created_at: new Date().toISOString(),
  }).catch(() => undefined);
  return { kind: "created" as const };
}

export const PARTNER_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const partnerUploadTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** A document from the partner, into KCPL's review queue; the customer sees it only once staff release it. */
const partnerFileExtensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** The browser's declared type is only a claim: the bytes must be that kind of file, as for every other upload. */
export function partnerFileMatchesType(contentType: string, data: ArrayBuffer) {
  const ext = partnerFileExtensions[contentType];
  return Boolean(ext) && validateShipmentDocumentBytes(ext, new Uint8Array(data)) === null;
}

/** Documents and invoices from one partner login, bounded per hour. */
export async function partnerWriteAllowed(session: PartnerSession) {
  const limit = await checkQuoteRateLimit({ subjects: [{ policy: quoteRateLimitPolicies.partner, value: session.email }], store: firestoreQuoteRateLimitStore() });
  return limit.allowed;
}

export async function uploadPartnerDocument(session: PartnerSession, reference: string, file: File, documentType: string) {
  const normalized = reference.trim().toUpperCase();
  const doc = await firebaseAdminDb().collection("shipments").doc(normalized).get();
  if (!doc.exists || !partnerCanSeeShipment(doc.data() as Record<string, unknown>, session.partnerId)) return { kind: "missing" as const };
  if (!partnerUploadTypes.includes(file.type)) return { kind: "unsupported_type" as const };
  if (file.size <= 0 || file.size > PARTNER_UPLOAD_MAX_BYTES) return { kind: "too_large" as const };
  const data = await file.arrayBuffer();
  if (!partnerFileMatchesType(file.type, data)) return { kind: "unsupported_type" as const };
  if (!await partnerWriteAllowed(session)) return { kind: "rate_limited" as const };
  const type = shipmentDocumentTypes.includes(documentType as ShipmentDocumentType) ? documentType as ShipmentDocumentType : "other";
  const result = await uploadShipmentDocument(normalized, {
    filename: file.name.slice(0, 200) || "document", contentType: file.type, sizeBytes: file.size, documentType: type,
    uploadedBy: session.partnerName, uploadedByEmail: session.email, data, source: "partner", uploadedByPartnerId: session.partnerId,
  });
  return result.kind === "created" ? { kind: "created" as const } : result.kind === "duplicate" ? { kind: "duplicate" as const } : { kind: "unavailable" as const };
}
