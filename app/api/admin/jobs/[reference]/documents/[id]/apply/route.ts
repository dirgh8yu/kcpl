import { applyDocumentReading } from "../../../../../../../admin/document-reading.server";
import { json, jobWriteRequest } from "../../../../job-route-auth";

/** Apply the details staff ticked from a reading: carrier, B/L or AWB number, ETA, containers. */
export async function POST(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const { reference, id } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  const documentId = Number(id);
  if (!Number.isSafeInteger(documentId)) return json({ ok: false, error: "That reading isn’t on this shipment." }, 404);
  const pick = (key: string) => auth.body[key] === true;
  try {
    const result = await applyDocumentReading(auth.reference, documentId, { carrier: pick("carrier"), carrierReference: pick("carrierReference"), eta: pick("eta"), containers: pick("containers") }, auth.actor);
    if (result.kind === "missing") return json({ ok: false, error: "That reading isn’t on this shipment. Read the document again." }, 404);
    return json({ ok: true, fields: result.fields, containersAdded: result.containersAdded });
  } catch (error) {
    console.error("KCPL apply reading failed", error);
    return json({ ok: false, error: "The details couldn’t be applied. Try again." }, 500);
  }
}
