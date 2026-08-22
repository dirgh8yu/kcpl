import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";
import { ediGatewayConfigured } from "../../../admin/edi/edi-gateway.server";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);
  try {
    const snapshot = await firebaseAdminDb().collection("edi_transactions").orderBy("created_at", "desc").limit(500).get();
    const rows = snapshot.docs.map((doc) => ({
      id: doc.id,
      direction: text(doc.get("direction")),
      transactionSet: text(doc.get("transaction_set")),
      status: text(doc.get("status")),
      branch: nullable(doc.get("branch")),
      partner: nullable(doc.get("partner")),
      reference: nullable(doc.get("reference")),
      tenderReference: nullable(doc.get("tender_reference")),
      shipmentReference: nullable(doc.get("shipment_reference")),
      transactionControl: nullable(doc.get("transaction_control")),
      message: nullable(doc.get("message")),
      createdAt: text(doc.get("created_at")),
      processedAt: nullable(doc.get("processed_at")),
    }));
    const attention = rows.filter((row) => row.status === "quarantined" || row.status === "failed" || (row.transactionSet === "204" && row.status === "queued")).slice(0, 60);
    return gptActionJson({
      ok: true,
      generatedAt: new Date().toISOString(),
      transportConfigured: ediGatewayConfigured(),
      sampledTransactionCount: rows.length,
      summary: {
        outbound204Queued: rows.filter((row) => row.transactionSet === "204" && row.status === "queued").length,
        outbound204Dispatched: rows.filter((row) => row.transactionSet === "204" && row.status === "dispatched").length,
        inbound990Processed: rows.filter((row) => row.transactionSet === "990" && row.status === "processed").length,
        inbound214Processed: rows.filter((row) => row.transactionSet === "214" && row.status === "processed").length,
        quarantinedOrFailed: rows.filter((row) => row.status === "quarantined" || row.status === "failed").length,
      },
      attention,
      recent: rows.slice(0, 80),
      safety: "Read-only EDI metadata only. Raw X12 payloads and KCPL_EDI_SECRET are excluded. The GPT cannot dispatch 204 tenders, acknowledge transport delivery, accept 990 responses, or inject 214 tracking events.",
    });
  } catch (error) {
    console.error("KCPL Custom GPT EDI briefing failed", error);
    return gptActionJson({ ok: false, error: "The KCPL EDI briefing is temporarily unavailable." }, 503);
  }
}
