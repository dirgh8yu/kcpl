import { uploadPartnerDocument } from "../../../../../partner/partner-data.server";
import { partnerJson, partnerWriteRequest } from "../../../../../partner/partner-route-auth";

/** A partner sends a document for the shipment; it waits for KCPL's review. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await partnerWriteRequest(request);
  if (!auth.ok) return auth.response;
  let form: FormData;
  try { form = await request.formData(); } catch { return partnerJson({ ok: false, error: "The upload could not be read." }, 400); }
  const file = form.get("file");
  if (!(file instanceof File)) return partnerJson({ ok: false, error: "Choose a file." }, 400);
  const { reference } = await context.params;
  const result = await uploadPartnerDocument(auth.session, decodeURIComponent(reference), file, typeof form.get("documentType") === "string" ? form.get("documentType") as string : "other");
  if (result.kind === "created") return partnerJson({ ok: true });
  if (result.kind === "missing") return partnerJson({ ok: false, error: "That shipment isn’t shared with you." }, 404);
  if (result.kind === "unsupported_type") return partnerJson({ ok: false, error: "Send a PDF or a photo (JPEG, PNG or WebP)." }, 400);
  if (result.kind === "too_large") return partnerJson({ ok: false, error: "That file is over 15 MB." }, 413);
  if (result.kind === "duplicate") return partnerJson({ ok: false, error: "That file is already on the shipment." }, 409);
  return partnerJson({ ok: false, error: "The document couldn’t be saved. Try again." }, 503);
}
