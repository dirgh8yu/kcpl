import { createDirectNotification } from "../admin/notifications/notification-centre.server";
import { firebaseAdminDb } from "../firebase-admin.server";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../shipment-document-types";
import { validateShipmentDocumentBytes } from "../shipment-document-policy";
import { uploadShipmentDocument } from "../shipment-documents.server";
import { checkQuoteRateLimit, quoteRateLimitPolicies } from "../api/quotes/quote-rate-limit-policy";
import { firestoreQuoteRateLimitStore } from "../api/quotes/quote-rate-limit.server";
import type { PortalSession } from "./portal-auth";
import { portalCanUploadDocumentType, PORTAL_UPLOAD_MAX_BYTES } from "./portal-access-policy";
import { portalOwnsShipment } from "./portal-data.server";
import { portalIntakeExtension, portalIntakeExtensions, portalWriteRefused, type PortalWriteResult } from "./portal-intake";

/*
 * Customer document upload, from the web portal or the KCPL app.
 *
 * The inbound direction is the one that needs the argument written down, so:
 *
 * - The customer never chooses where the file lands. The shipment comes from
 *   the path and is checked against the session's own customer before a byte is
 *   read; the document type must be on the portal's allowlist of papers a
 *   shipper originates. A customer cannot file a bill of lading, a customs
 *   entry or a proof of delivery.
 * - The upload enters as `received` and not released to the portal, which is
 *   what `uploadShipmentDocument` writes for everyone. A customer upload is
 *   evidence awaiting review, never verified paperwork, and it cannot be
 *   released back to the portal until a staff member says so.
 * - It can never replace an existing document. Replacing KCPL's copy of
 *   anything is a staff decision, so no such field is accepted here at all.
 * - Extension, declared type and magic bytes must agree, exactly as on the
 *   staff route: the file is sniffed, not trusted.
 */

/** Checks that need nothing from the request body, so a refused caller is
 * turned away before the upload is read. */
async function admitPortalDocument(session: PortalSession, reference: string): Promise<PortalWriteResult | { normalized: string }> {
  if (!session.capabilities.canSubmitRequests) {
    return portalWriteRefused(403, "forbidden", "This account can view shipments but cannot send documents.");
  }

  const normalized = reference.trim().toUpperCase();
  // Reported as missing rather than forbidden: a 403 would confirm the
  // reference belongs to somebody.
  if (!await portalOwnsShipment(session, normalized)) {
    return portalWriteRefused(404, "missing", "Shipment not found.");
  }

  const limit = await checkQuoteRateLimit({
    subjects: [{ policy: quoteRateLimitPolicies.address, value: session.email }],
    store: firestoreQuoteRateLimitStore(),
  });
  if (!limit.allowed) {
    return {
      ...portalWriteRefused(429, "rate_limited", "Too many uploads from this account just now. Please try again shortly."),
      retryAfter: limit.retryAfterSeconds,
    };
  }
  return { normalized };
}

export async function receivePortalDocument(session: PortalSession, reference: string, request: Request): Promise<PortalWriteResult> {
  const admitted = await admitPortalDocument(session, reference);
  if ("status" in admitted) return admitted;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return portalWriteRefused(400, "invalid", "The upload could not be read.");
  }

  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "").trim();
  if (!(file instanceof File)) return portalWriteRefused(400, "invalid", "Choose a file to send.");
  if (!portalCanUploadDocumentType(documentType)) {
    return portalWriteRefused(400, "invalid", "That document type is not one KCPL accepts from customers.");
  }

  const ext = portalIntakeExtension(file.name);
  const contentType = portalIntakeExtensions[ext];
  if (!contentType) return portalWriteRefused(415, "unsupported", "Send a PDF, JPEG, PNG or WEBP file.");
  if (file.size <= 0) return portalWriteRefused(400, "invalid", "The selected file is empty.");
  if (file.size > PORTAL_UPLOAD_MAX_BYTES) {
    return portalWriteRefused(413, "too_large", `Files must be ${Math.floor(PORTAL_UPLOAD_MAX_BYTES / (1024 * 1024))} MB or smaller.`);
  }

  const data = await file.arrayBuffer();
  const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
  if (signatureError) return portalWriteRefused(415, "unsupported", signatureError);

  try {
    const result = await uploadShipmentDocument(admitted.normalized, {
      filename: file.name,
      contentType,
      sizeBytes: file.size,
      documentType,
      uploadedBy: session.customerName,
      uploadedByEmail: session.email,
      data,
      source: "customer_portal",
    });

    if (result.kind === "unavailable") return portalWriteRefused(503, "unavailable", "Document storage is unavailable. Please try again shortly.");
    if (result.kind === "missing") return portalWriteRefused(404, "missing", "Shipment not found.");
    if (result.kind === "duplicate") {
      return { status: 200, body: { ok: true, duplicate: true, message: "KCPL already has this exact file for this shipment." } };
    }
    if (result.kind !== "created") return portalWriteRefused(500, "failed", "The document could not be sent.");

    // The document is stored; telling the operator is a courtesy on top of it.
    // A notification failure must not turn a successful upload into an error
    // the customer is asked to retry, so it is awaited but never thrown.
    await notifyAssignedOperator(admitted.normalized, documentType, session.customerName, file.name);

    return { status: 201, body: { ok: true, message: "Sent to KCPL. It will show as confirmed once the team has checked it." } };
  } catch (error) {
    console.error("KCPL portal document upload failed", error);
    return portalWriteRefused(500, "failed", "The document could not be sent.");
  }
}

/**
 * Put an inbound customer document in front of the person who owns the job.
 *
 * Without this the file waits in the Document Vault for someone to notice it,
 * which is the failure mode the whole feature exists to remove. An unassigned
 * shipment has nobody to tell; the vault's "From customers" filter is the
 * backstop for those.
 */
async function notifyAssignedOperator(reference: string, documentType: string, customerName: string, filename: string) {
  try {
    const shipment = await firebaseAdminDb().collection("shipments").doc(reference).get();
    const targetEmail = typeof shipment.get("job_assigned_to_email") === "string" ? shipment.get("job_assigned_to_email") as string : "";
    if (!targetEmail.trim()) return;
    const label = shipmentDocumentTypeLabels[documentType as ShipmentDocumentType] ?? "Document";
    await createDirectNotification({
      targetEmail,
      targetName: typeof shipment.get("job_assigned_to_name") === "string" ? shipment.get("job_assigned_to_name") as string : null,
      category: "documents",
      severity: "info",
      title: `${label} received from ${customerName}`,
      detail: `${filename} arrived from the customer and is waiting for review on ${reference}.`,
      actionPath: `/admin/documents?q=${encodeURIComponent(reference)}`,
      parentReference: reference,
      sourceType: "operational",
      sourceId: reference,
    });
  } catch (error) {
    console.error("KCPL portal upload notification failed", error);
  }
}
