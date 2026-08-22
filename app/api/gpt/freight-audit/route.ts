import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";
import { freightAuditPaymentAllowed, type FreightAuditStatus } from "../../../admin/freight-audit/freight-audit";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function numberOrNull(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);

  try {
    const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase().slice(0, 180) ?? "";
    const db = firebaseAdminDb();
    const payableSnapshot = await db.collection("payables").orderBy("updated_at", "desc").limit(1000).get();
    const billDocs = payableSnapshot.docs.filter((doc) => text(doc.get("record_type")) !== "opening_balance" && text(doc.get("status")) !== "void");
    const auditRefs = billDocs.map((doc) => db.collection("freight_audits").doc(doc.id));
    const auditSnapshots: FirebaseFirestore.DocumentSnapshot[] = [];
    for (let index = 0; index < auditRefs.length; index += 250) auditSnapshots.push(...await db.getAll(...auditRefs.slice(index, index + 250)));
    const audits = new Map(auditSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data() as Record<string, unknown>]));

    const allRows = billDocs.map((doc) => {
      const bill = doc.data() as Record<string, unknown>;
      const audit = audits.get(doc.id);
      const rawStatus = text(audit?.status, "pending") as FreightAuditStatus;
      const status: FreightAuditStatus = ["pending", "matched", "review_required", "disputed", "approved_variance", "rejected", "not_applicable"].includes(rawStatus) ? rawStatus : "pending";
      const auditUpdatedAt = nullable(audit?.updated_at);
      const billUpdatedAt = nullable(bill.updated_at);
      const stale = Boolean(auditUpdatedAt && billUpdatedAt && auditUpdatedAt < billUpdatedAt);
      return {
        payableReference: doc.id,
        supplierName: text(bill.supplier_name, "Supplier"),
        supplierBillReference: nullable(bill.supplier_bill_reference),
        shipmentReference: nullable(bill.shipment_reference),
        branch: nullable(bill.branch),
        payableStatus: text(bill.status, "draft"),
        invoiceCurrency: text(bill.currency, "NPR"),
        invoiceSubtotal: numberOrNull(bill.subtotal),
        invoiceTotal: numberOrNull(bill.total),
        auditStatus: status,
        paymentAllowed: freightAuditPaymentAllowed(status) && !stale,
        auditStale: stale,
        bookedCurrency: nullable(audit?.booked_currency),
        bookedCost: numberOrNull(audit?.booked_cost),
        varianceAmount: numberOrNull(audit?.variance_amount),
        variancePercent: numberOrNull(audit?.variance_percent),
        duplicateOf: nullable(audit?.duplicate_of),
        issues: Array.isArray(audit?.issues) ? audit?.issues : [],
        disputeNote: nullable(audit?.dispute_note),
        resolutionNote: nullable(audit?.resolution_note),
        auditedAt: nullable(audit?.audited_at),
        approvedAt: nullable(audit?.approved_at),
        updatedAt: billUpdatedAt,
      };
    });

    const rows = query ? allRows.filter((row) => [row.payableReference, row.supplierName, row.supplierBillReference, row.shipmentReference, row.branch, row.auditStatus].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))) : allRows;
    const attention = rows.filter((row) => !row.paymentAllowed || row.auditStatus === "disputed").slice(0, 50);
    return gptActionJson({
      ok: true,
      generatedAt: new Date().toISOString(),
      query: query || null,
      sampledPayableCount: payableSnapshot.size,
      supplierBillCount: rows.length,
      summary: {
        matched: rows.filter((row) => row.auditStatus === "matched").length,
        reviewRequired: rows.filter((row) => row.auditStatus === "review_required").length,
        disputed: rows.filter((row) => row.auditStatus === "disputed").length,
        approvedVariance: rows.filter((row) => row.auditStatus === "approved_variance").length,
        pendingOrStale: rows.filter((row) => row.auditStatus === "pending" || row.auditStale).length,
        paymentBlocked: rows.filter((row) => !row.paymentAllowed).length,
      },
      attentionCount: attention.length,
      attention,
      matches: query ? rows.slice(0, 50) : undefined,
      safety: "This Custom GPT action is read-only. It cannot approve variances, approve supplier bills, or record payments.",
    });
  } catch (error) {
    console.error("KCPL Custom GPT Freight Audit briefing failed", error);
    return gptActionJson({ ok: false, error: "The KCPL Freight Audit briefing is temporarily unavailable." }, 503);
  }
}
