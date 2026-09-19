import { getPortalAccess, type PortalSession } from "../../../../portal/portal-auth";
import { portalOwnsShipment } from "../../../../portal/portal-data.server";
import {
  portalCanUploadDocumentType,
  PORTAL_UPLOAD_MAX_BYTES,
} from "../../../../portal/portal-access-policy";
import { isTrustedSameOriginRequest } from "../../../../request-security";
import { validateShipmentDocumentBytes } from "../../../../shipment-document-policy";
import { uploadShipmentDocument } from "../../../../shipment-documents.server";
import { checkQuoteRateLimit, quoteRateLimitPolicies } from "../../../quotes/quote-rate-limit-policy";
import { firestoreQuoteRateLimitStore } from "../../../quotes/quote-rate-limit.server";

/*
 * Customer document upload.
 *
 * The inbound direction is the one that needs the argument written down, so:
 *
 * - The customer never chooses where the file lands. The shipment comes from
 *   the path and is checked against the session's own customer before a byte is
 *   read; the document type must be on the portal's allowlist of papers a
 *   shipper originates. A customer cannot file a bill of lading, a customs
 *   entry or a proof of delivery.
 * - The upload enters as `received` and `customer_safe: false`, which is what
 *   `uploadShipmentDocument` writes for everyone. A customer upload is evidence
 *   awaiting review, never verified paperwork, and it cannot be released back
 *   to the portal until a staff member says so.
 * - It can never supersede an existing document. Replacing KCPL's copy of
 *   anything is a staff decision, so `supersedesDocumentId` is not accepted
 *   from this route at all.
 * - Extension, declared type and magic bytes must agree, exactly as on the
 *   staff route: the file is sniffed, not trusted.
 */

// Narrower than the staff vault on purpose: a customer sends invoices, permits
// and photographs of paperwork, not spreadsheets or Word documents.
const allowedExtensions: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function extension(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

async function authorize(request: Request, reference: string): Promise<
  { session: PortalSession; normalized: string } | { response: Response }
> {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return { response: json({ ok: false, error: "The customer portal is not configured." }, 503) };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  if (!isTrustedSameOriginRequest(request)) return { response: json({ ok: false, error: "Cross-origin uploads are not accepted." }, 403) };
  if (!access.session.capabilities.canSubmitRequests) {
    return { response: json({ ok: false, error: "This account can view shipments but cannot send documents." }, 403) };
  }

  const normalized = reference.trim().toUpperCase();
  // Reported as missing rather than forbidden: a 403 would confirm the
  // reference belongs to somebody.
  if (!await portalOwnsShipment(access.session, normalized)) {
    return { response: json({ ok: false, error: "Shipment not found." }, 404) };
  }
  return { session: access.session, normalized };
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await authorize(request, reference);
  if ("response" in auth) return auth.response;

  const limit = await checkQuoteRateLimit({
    subjects: [{ policy: quoteRateLimitPolicies.address, value: auth.session.email }],
    store: firestoreQuoteRateLimitStore(),
  });
  if (!limit.allowed) {
    return json(
      { ok: false, error: "Too many uploads from this account just now. Please try again shortly." },
      429,
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "The upload could not be read." }, 400);
  }

  const file = form.get("file");
  const documentType = String(form.get("documentType") ?? "").trim();
  if (!(file instanceof File)) return json({ ok: false, error: "Choose a file to send." }, 400);
  if (!portalCanUploadDocumentType(documentType)) {
    return json({ ok: false, error: "That document type is not one KCPL accepts from customers." }, 400);
  }

  const ext = extension(file.name);
  const contentType = allowedExtensions[ext];
  if (!contentType) {
    return json({ ok: false, error: "Send a PDF, JPEG, PNG or WEBP file." }, 415);
  }
  if (file.size <= 0) return json({ ok: false, error: "The selected file is empty." }, 400);
  if (file.size > PORTAL_UPLOAD_MAX_BYTES) {
    return json({ ok: false, error: `Files must be ${Math.floor(PORTAL_UPLOAD_MAX_BYTES / (1024 * 1024))} MB or smaller.` }, 413);
  }

  const data = await file.arrayBuffer();
  const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
  if (signatureError) return json({ ok: false, error: signatureError }, 415);

  try {
    const result = await uploadShipmentDocument(auth.normalized, {
      filename: file.name,
      contentType,
      sizeBytes: file.size,
      documentType,
      uploadedBy: auth.session.customerName,
      uploadedByEmail: auth.session.email,
      data,
      source: "customer_portal",
    });

    if (result.kind === "unavailable") return json({ ok: false, error: "Document storage is unavailable. Please try again shortly." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
    if (result.kind === "duplicate") {
      return json({ ok: true, duplicate: true, message: "KCPL already has this exact file for this shipment." }, 200);
    }
    if (result.kind !== "created") return json({ ok: false, error: "The document could not be sent." }, 500);

    return json({ ok: true, message: "Sent to KCPL. It will show as confirmed once the team has checked it." }, 201);
  } catch (error) {
    console.error("KCPL portal document upload failed", error);
    return json({ ok: false, error: "The document could not be sent." }, 500);
  }
}
