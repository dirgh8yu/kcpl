import Anthropic from "@anthropic-ai/sdk";
import { firebaseAdminDb } from "../firebase-admin.server";
import { getShipmentDocumentFile } from "../shipment-documents.server";
import { shipmentDocumentTypeLabels } from "../shipment-document-types";
import { addShipmentContainers } from "../shipment-containers.server";
import {
  READABLE_MAX_BYTES,
  cleanDocumentReading,
  documentReadingInstructions,
  documentReadingSchema,
  readableContentTypes,
  type DocumentReading,
} from "../document-reading";

/*
 * Reads an uploaded bill of lading, air waybill, commercial invoice or packing
 * list with Claude and keeps what it found beside the document, for staff to
 * review. The API key comes from the server's environment (ANTHROPIC_API_KEY)
 * and nowhere else. Applying a reading is a separate step that writes only the
 * fields staff tick.
 */

const READINGS = "document_readings";
/** The model that reads the document; extraction needs care more than depth, so medium effort. */
const READER_MODEL = "claude-opus-5-5";

type Actor = { name: string; email: string };

export function documentReadingConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export type StoredReading = DocumentReading & {
  document_id: number;
  filename: string;
  read_at: string;
  read_by_name: string;
  applied_at: string | null;
  applied_by_name: string | null;
};

function readingFromDoc(doc: FirebaseFirestore.DocumentSnapshot): StoredReading | null {
  const data = doc.data() as Record<string, unknown> | undefined;
  const reading = cleanDocumentReading(data?.reading);
  if (!data || !reading) return null;
  const text = (value: unknown) => typeof value === "string" ? value : null;
  return {
    ...reading,
    document_id: Number(doc.id),
    filename: text(data.filename) ?? "Document",
    read_at: text(data.read_at) ?? "",
    read_by_name: text(data.read_by_name) ?? "KCPL Staff",
    applied_at: text(data.applied_at),
    applied_by_name: text(data.applied_by_name),
  };
}

export async function listDocumentReadings(reference: string): Promise<StoredReading[]> {
  try {
    const snapshot = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).collection(READINGS).orderBy("read_at", "desc").limit(30).get();
    return snapshot.docs.map(readingFromDoc).filter((item): item is StoredReading => item !== null);
  } catch (error) {
    console.error("KCPL document readings failed", error);
    return [];
  }
}

/** Read one uploaded document. Re-reading replaces the earlier reading of the same document. */
export async function readShipmentDocument(reference: string, documentId: number, actor: Actor) {
  if (!documentReadingConfigured()) return { kind: "not_configured" as const };
  const file = await getShipmentDocumentFile(reference, documentId);
  if (file.kind !== "ready") return { kind: file.kind === "unavailable" ? "unavailable" as const : "missing" as const };
  const contentType = file.document.content_type.split(";")[0].trim().toLowerCase();
  if (!(readableContentTypes as readonly string[]).includes(contentType)) return { kind: "unsupported_type" as const };
  if (file.bytes.length > READABLE_MAX_BYTES) return { kind: "too_large" as const };

  const data = Buffer.from(file.bytes).toString("base64");
  const source = contentType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: contentType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data } };
  const client = new Anthropic();
  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await client.beta.messages.create({
      model: READER_MODEL,
      max_tokens: 16000,
      // On a policy decline, the API retries the same request on a suitable model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: documentReadingInstructions,
      output_config: { effort: "medium", format: { type: "json_schema", schema: documentReadingSchema as unknown as Record<string, unknown> } },
      messages: [{
        role: "user",
        content: [
          source,
          { type: "text", text: `KCPL filed this as: ${shipmentDocumentTypeLabels[file.document.document_type] ?? "a shipment document"} (file name ${file.document.filename}). Read it.` },
        ],
      }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { kind: "busy" as const };
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return { kind: "not_configured" as const };
    if (error instanceof Anthropic.BadRequestError) { console.error("KCPL document reading refused by the API", error.message); return { kind: "unreadable" as const }; }
    console.error("KCPL document reading failed", error);
    return { kind: "unavailable" as const };
  }
  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") return { kind: "unreadable" as const };
  const textBlock = message.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text");
  let parsed: unknown = null;
  try { parsed = textBlock ? JSON.parse(textBlock.text) : null; } catch { parsed = null; }
  const reading = cleanDocumentReading(parsed);
  if (!reading) return { kind: "unreadable" as const };

  const now = new Date().toISOString();
  const shipment = firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase());
  const batch = firebaseAdminDb().batch();
  batch.set(shipment.collection(READINGS).doc(String(documentId)), {
    reading, filename: file.document.filename, model: message.model, read_at: now, read_by_name: actor.name, read_by_email: actor.email,
    applied_at: null, applied_by_name: null, input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens,
  });
  batch.create(shipment.collection("job_activity").doc(`document-read-${documentId}-${Date.now()}`), {
    type: "document_read", title: `Read ${file.document.filename}`, detail: [reading.document_number, reading.containers.length ? `${reading.containers.length} container${reading.containers.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || null,
    actor_name: actor.name, actor_email: actor.email, created_at: now,
  });
  await batch.commit();
  return { kind: "read" as const, reading };
}

export type ReadingChoices = { carrier: boolean; carrierReference: boolean; eta: boolean; containers: boolean };

/** Apply the fields staff ticked from a reading. Containers already on the shipment are skipped. */
export async function applyDocumentReading(reference: string, documentId: number, choices: ReadingChoices, actor: Actor) {
  const db = firebaseAdminDb();
  const shipment = db.collection("shipments").doc(reference.trim().toUpperCase());
  const doc = await shipment.collection(READINGS).doc(String(documentId)).get();
  const reading = doc.exists ? readingFromDoc(doc) : null;
  if (!reading) return { kind: "missing" as const };
  const patch: Record<string, string> = {};
  if (choices.carrier && reading.carrier) patch.carrier = reading.carrier;
  if (choices.carrierReference && reading.document_number && reading.document_type !== "commercial_invoice" && reading.document_type !== "packing_list") patch.carrier_reference = reading.document_number;
  if (choices.eta && reading.eta) patch.eta = reading.eta;
  const applied: string[] = Object.keys(patch);
  let containersAdded = 0;
  if (choices.containers) {
    // One call per size, so each box keeps the size read for it.
    const valid = reading.containers.filter((item) => item.valid);
    const bySize = new Map<string, string[]>();
    for (const item of valid) bySize.set(item.size_type ?? "40HC", [...(bySize.get(item.size_type ?? "40HC") ?? []), item.number]);
    for (const [sizeType, numbers] of bySize) {
      const result = await addShipmentContainers(shipment.id, { numbers: numbers.join("\n"), sizeType }, actor);
      if (result.kind === "added") containersAdded += result.added.length;
    }
    if (valid.length) applied.push("containers");
  }
  const now = new Date().toISOString();
  const batch = db.batch();
  if (Object.keys(patch).length) batch.update(shipment, { ...patch, updated_at: now });
  batch.update(doc.ref, { applied_at: now, applied_by_name: actor.name, applied_fields: applied });
  batch.create(shipment.collection("job_activity").doc(`document-applied-${documentId}-${Date.now()}`), {
    type: "document_reading_applied", title: `Details from ${reading.filename} applied`,
    detail: [...Object.keys(patch).map((key) => key.replace("_", " ")), containersAdded ? `${containersAdded} container${containersAdded === 1 ? "" : "s"} added` : ""].filter(Boolean).join(" · ") || "Nothing new to apply",
    actor_name: actor.name, actor_email: actor.email, created_at: now,
  });
  await batch.commit();
  return { kind: "applied" as const, fields: Object.keys(patch), containersAdded };
}
