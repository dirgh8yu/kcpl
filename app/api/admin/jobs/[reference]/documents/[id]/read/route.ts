import { readShipmentDocument } from "../../../../../../../admin/document-reading.server";
import { json, jobWriteRequest } from "../../../../job-route-auth";

const errors: Record<string, [string, number]> = {
  not_configured: ["Document reading isn’t set up on this server. Management adds an ANTHROPIC_API_KEY to the server’s environment to turn it on.", 503],
  unavailable: ["The document reader isn’t responding. Try again in a minute.", 503],
  missing: ["That document isn’t on this shipment any more.", 404],
  unsupported_type: ["Only PDFs and photos (PNG, JPEG, WebP) can be read.", 400],
  too_large: ["That file is over 20 MB. Upload a smaller scan to read it.", 413],
  busy: ["The document reader is busy. Try again in a minute.", 429],
  unreadable: ["The document couldn’t be read. Check it’s the right file and clearly scanned, or enter the details by hand.", 422],
};

/** Read an uploaded shipping document; staff review what was found before anything is applied. */
export async function POST(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const { reference, id } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  const documentId = Number(id);
  if (!Number.isSafeInteger(documentId)) return json({ ok: false, error: "That document isn’t on this shipment any more." }, 404);
  const result = await readShipmentDocument(auth.reference, documentId, auth.actor);
  if (result.kind === "read") return json({ ok: true, reading: result.reading });
  const [error, status] = errors[result.kind] ?? errors.unavailable;
  return json({ ok: false, error }, status);
}
