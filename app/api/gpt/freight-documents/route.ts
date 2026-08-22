import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";
import { generatedFreightDocumentKinds, generatedFreightDocumentLabels, primaryCarriageDocumentKind, type GeneratedFreightDocumentKind } from "../../../admin/freight-documents/freight-documents";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const result = text(value); return result || null; }

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);
  try {
    const db = firebaseAdminDb();
    const [shipments, generatedDocs] = await Promise.all([
      db.collection("shipments").orderBy("updated_at", "desc").limit(1200).get(),
      db.collectionGroup("documents").where("generated_by_engine", "==", true).limit(5000).get(),
    ]);
    const byShipment = new Map<string, Array<{ id: string; kind: GeneratedFreightDocumentKind; label: string; filename: string; revision: number; status: string; generatedAt: string; sha256: string }>>();
    for (const doc of generatedDocs.docs) {
      const reference = doc.ref.parent.parent?.id ?? "";
      const kind = text(doc.get("generated_document_kind")) as GeneratedFreightDocumentKind;
      if (!reference || !generatedFreightDocumentKinds.includes(kind)) continue;
      const item = { id: doc.id, kind, label: generatedFreightDocumentLabels[kind], filename: text(doc.get("filename")), revision: Math.max(1, Number(doc.get("generated_revision") ?? 1)), status: text(doc.get("review_status"), "received"), generatedAt: text(doc.get("generated_at"), text(doc.get("uploaded_at"))), sha256: text(doc.get("sha256")) };
      byShipment.set(reference, [...(byShipment.get(reference) ?? []), item]);
    }
    const attention = shipments.docs.flatMap((doc) => {
      const status = text(doc.get("status"));
      if (status === "cancelled") return [];
      const mode = text(doc.get("mode"));
      const documents = (byShipment.get(doc.id) ?? []).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
      const current = documents.filter((item) => item.status !== "superseded" && item.status !== "deleted");
      const primary = primaryCarriageDocumentKind(mode);
      const missingPrimary = Boolean(primary && !current.some((item) => item.kind === primary));
      const reviewPending = current.filter((item) => item.status === "received" || item.status === "under_review").length;
      if (!missingPrimary && !reviewPending) return [];
      return [{
        reference: doc.id,
        branch: nullable(doc.get("primary_branch")),
        mode,
        bookingReference: nullable(doc.get("booking_reference")),
        carrier: nullable(doc.get("carrier")),
        shipmentStatus: status,
        missingPrimaryCarriageDocument: missingPrimary,
        expectedPrimaryKind: primary,
        reviewPending,
        currentGeneratedDocuments: current.map((item) => ({ kind: item.kind, label: item.label, filename: item.filename, revision: item.revision, reviewStatus: item.status, generatedAt: item.generatedAt, sha256: item.sha256 })),
      }];
    }).slice(0, 60);
    const allCurrent = [...byShipment.values()].flat().filter((item) => item.status !== "superseded" && item.status !== "deleted");
    return gptActionJson({
      ok: true,
      generatedAt: new Date().toISOString(),
      sampledShipmentCount: shipments.size,
      generatedDocumentCount: generatedDocs.size,
      summary: {
        currentGenerated: allCurrent.length,
        awaitingReview: allCurrent.filter((item) => item.status === "received" || item.status === "under_review").length,
        verified: allCurrent.filter((item) => item.status === "verified").length,
        shipmentAttentionCount: attention.length,
      },
      attention,
      safety: "This action is read-only. It exposes document metadata and hashes only. Firebase Storage paths, signed URLs and PDF binaries are intentionally excluded, and the GPT cannot generate or verify freight documents.",
    });
  } catch (error) {
    console.error("KCPL Custom GPT freight document briefing failed", error);
    return gptActionJson({ ok: false, error: "The KCPL freight document briefing is temporarily unavailable." }, 503);
  }
}
