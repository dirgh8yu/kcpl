import { submitPartnerBill } from "../../../../../partner/partner-bills.server";
import { partnerJson, partnerWriteRequest } from "../../../../../partner/partner-route-auth";

const errors: Record<string, string> = {
  number: "Enter your invoice number.",
  date: "Enter the invoice date, not a future date.",
  currency: "Choose the invoice currency.",
  amount: "Enter the amount before VAT.",
  vat: "Choose 13% VAT for a Nepali VAT invoice, or none.",
};

/** A partner sends their invoice for the shipment; it becomes a draft bill for KCPL's Accounts. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await partnerWriteRequest(request);
  if (!auth.ok) return auth.response;
  let form: FormData;
  try { form = await request.formData(); } catch { return partnerJson({ ok: false, error: "The invoice could not be read." }, 400); }
  const file = form.get("file");
  const field = (key: string) => typeof form.get(key) === "string" ? form.get(key) as string : "";
  const { reference } = await context.params;
  const result = await submitPartnerBill(auth.session, decodeURIComponent(reference), {
    invoiceNumber: field("invoiceNumber"), invoiceDate: field("invoiceDate"), currency: field("currency"), amount: field("amount"), vatRate: field("vatRate") || "0", description: field("description"),
  }, file instanceof File ? file : null);
  if (result.kind === "created") return partnerJson({ ok: true });
  if (result.kind === "missing") return partnerJson({ ok: false, error: "That shipment isn’t shared with you." }, 404);
  if (result.kind === "invalid") return partnerJson({ ok: false, error: errors[result.error] }, 400);
  if (result.kind === "file_required") return partnerJson({ ok: false, error: "Attach the invoice (PDF or a photo)." }, 400);
  if (result.kind === "unsupported_type") return partnerJson({ ok: false, error: "Send a PDF or a photo (JPEG, PNG or WebP)." }, 400);
  if (result.kind === "too_large") return partnerJson({ ok: false, error: "That file is over 15 MB." }, 413);
  if (result.kind === "rate_limited") return partnerJson({ ok: false, error: "Too many uploads from this login just now. Try again in a while." }, 429);
  if (result.kind === "duplicate") return partnerJson({ ok: false, error: "KCPL already has an invoice with that number from you." }, 409);
  if (result.kind === "other_branch") return partnerJson({ ok: false, error: "Your company is set up with another KCPL branch, so this invoice can’t be filed here. Send it to your KCPL contact." }, 409);
  return partnerJson({ ok: false, error: "The invoice couldn’t be sent. Try again." }, 503);
}
