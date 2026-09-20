import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { listShipmentDocuments } from "../shipment-documents.server";
import { portalDocumentReleased } from "./portal-access-policy";
import {
  PORTAL_ACCESS_LOG_LIMIT,
  portalAccessEventId,
  portalAccessSummaries,
  portalUndownloadedDocuments,
  type PortalAccessEvent,
} from "./portal-access-log";

const ACCESS_COLLECTION = "document_access";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function accessEvent(id: string, data: Record<string, unknown>): PortalAccessEvent {
  const documentId = Number(data.document_id);
  return {
    id,
    document_id: Number.isFinite(documentId) ? documentId : 0,
    document_type: text(data.document_type, "other"),
    filename: text(data.filename, "document"),
    account_email: text(data.account_email),
    customer_id: text(data.customer_id),
    at: text(data.at),
    size_bytes: Number.isFinite(Number(data.size_bytes)) ? Number(data.size_bytes) : 0,
  };
}

/**
 * Record one customer download.
 *
 * Shipment-linked evidence and nothing else: this writes a row in the
 * shipment's own `document_access` subcollection and never touches the
 * shipment document, its status, or the document record that was fetched.
 * Reading a file cannot change the thing that was read.
 *
 * Returns a boolean rather than throwing. A download that succeeded must not
 * be failed by its own bookkeeping -- the customer has the bytes either way,
 * and a lost log line is a smaller harm than a lost document.
 */
export async function recordPortalDocumentDownload(input: {
  reference: string;
  documentId: number;
  documentType: string;
  filename: string;
  sizeBytes: number;
  accountEmail: string;
  customerId: string;
  at?: string;
}) {
  if (!firebaseRuntimeConfigured()) return false;
  const reference = input.reference.trim().toUpperCase();
  if (!reference || !Number.isFinite(input.documentId)) return false;

  const at = input.at ?? new Date().toISOString();
  const id = portalAccessEventId({ documentId: input.documentId, at, email: input.accountEmail });
  try {
    await firebaseAdminDb().collection("shipments").doc(reference)
      .collection(ACCESS_COLLECTION).doc(id)
      .set({
        document_id: input.documentId,
        document_type: input.documentType,
        filename: input.filename,
        account_email: input.accountEmail.trim().toLowerCase(),
        customer_id: input.customerId,
        at,
        size_bytes: input.sizeBytes,
      });
    return true;
  } catch (error) {
    console.error("KCPL portal document access log write failed", error);
    return false;
  }
}

/** The access log for one shipment, newest first. Staff-side read. */
export async function listPortalDocumentAccess(reference: string, limit = PORTAL_ACCESS_LOG_LIMIT) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const normalized = reference.trim().toUpperCase();
  if (!normalized) return { kind: "unavailable" as const };
  try {
    const snapshot = await firebaseAdminDb().collection("shipments").doc(normalized)
      .collection(ACCESS_COLLECTION)
      .orderBy("at", "desc")
      .limit(limit)
      .get();
    return {
      kind: "ready" as const,
      events: snapshot.docs.map((document) => accessEvent(document.id, document.data() as Record<string, unknown>)),
    };
  } catch (error) {
    console.error("KCPL portal document access log read failed", error);
    return { kind: "unavailable" as const };
  }
}

/**
 * The Job File view of customer access: what has been collected, and what has
 * been released but never opened.
 *
 * Both halves are assembled here rather than in the page so the page stays a
 * renderer -- and so "released" means exactly what the portal means by it,
 * `portalDocumentReleased`, not a second opinion about `customer_safe`.
 */
export async function shipmentCustomerAccessView(reference: string) {
  const [access, documents] = await Promise.all([
    listPortalDocumentAccess(reference),
    listShipmentDocuments(reference),
  ]);
  if (access.kind !== "ready") return { kind: "unavailable" as const };

  const released = documents.kind === "ready"
    ? documents.documents
        .filter((document) => portalDocumentReleased(document as unknown as Record<string, unknown>))
        .map((document) => ({ id: document.id, document_type: document.document_type, filename: document.filename }))
    : [];

  return {
    kind: "ready" as const,
    summaries: portalAccessSummaries(access.events),
    pending: portalUndownloadedDocuments(released, access.events),
    releasedCount: released.length,
  };
}
