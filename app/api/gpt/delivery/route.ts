import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";
import { deliveryAttemptStatuses, deriveDeliveryState, summarizeDelivery, type DeliveryAttemptStatus, type DeliveryQueueRow } from "../../../admin/delivery/delivery-control";
import { kcplBranches, type KcplBranch } from "../../../admin/crm/crm-data";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const v = text(value); return v || null; }
function numberOrNull(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }

async function loadDocumentsByIds(collectionName: string, ids: string[]) {
  const db = firebaseAdminDb();
  const unique = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < unique.length; index += 250) {
    const snapshots = await db.getAll(...unique.slice(index, index + 250).map((value) => db.collection(collectionName).doc(value)));
    for (const snapshot of snapshots) if (snapshot.exists) result.set(snapshot.id, snapshot.data() as Record<string, unknown>);
  }
  return result;
}

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);
  try {
    const snapshot = await firebaseAdminDb().collection("shipments").orderBy("updated_at", "desc").limit(1000).get();
    const relevant = snapshot.docs.filter((doc) => {
      const status = text(doc.get("status"));
      return status === "out_for_delivery" || status === "delivered" || Number(doc.get("delivery_attempt_count") ?? 0) > 0 || Boolean(doc.get("delivery_pod_status"));
    });
    const quoteIds = relevant.map((doc) => text(doc.get("quote_reference"))).filter(Boolean);
    const customerIds = relevant.map((doc) => nullable(doc.get("customer_id"))).filter((value): value is string => Boolean(value));
    const [quotes, customers] = await Promise.all([loadDocumentsByIds("quotes", quoteIds), loadDocumentsByIds("customers", customerIds)]);
    const rows: DeliveryQueueRow[] = relevant.flatMap((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const primary = branchValue(data.primary_branch);
      if (!primary) return [];
      const quote = quotes.get(text(data.quote_reference)) ?? {};
      const customerId = nullable(data.customer_id);
      const customer = customerId ? customers.get(customerId) : null;
      const rawStatus = nullable(data.delivery_last_attempt_status) as DeliveryAttemptStatus | null;
      const attemptStatus = rawStatus && deliveryAttemptStatuses.includes(rawStatus) ? rawStatus : null;
      const podStatus = text(data.delivery_pod_status, "not_received") as "not_received" | "received" | "rejected" | "verified";
      return [{
        reference: doc.id,
        quote_reference: text(data.quote_reference),
        customer_id: customerId,
        customer_name: customer ? text(customer.display_name, "Linked customer") : text(quote.company_name, text(quote.contact_name, "Customer")),
        origin: text(quote.origin, text(data.origin)),
        destination: text(quote.destination, text(data.destination)),
        mode: text(quote.mode, text(data.mode)),
        primary_branch: primary,
        status: text(data.status, "booking_confirmed"),
        delivery_state: deriveDeliveryState({ shipmentStatus: text(data.status), attemptStatus, podStatus }),
        attempt_count: numberOrNull(data.delivery_attempt_count) ?? 0,
        last_attempt_status: attemptStatus,
        last_attempt_at: nullable(data.delivery_last_attempt_at),
        pod_status: podStatus,
        pod_evidence_count: numberOrNull(data.delivery_pod_evidence_count) ?? 0,
        recipient_name: nullable(data.delivery_recipient_name),
        next_delivery_at: nullable(data.delivery_next_at),
        current_location: nullable(data.current_location),
        updated_at: text(data.updated_at),
      }];
    });
    const summary = summarizeDelivery(rows);
    const attention = rows
      .filter((row) => row.delivery_state === "delivery_failed" || row.delivery_state === "delivered_pod_pending" || row.delivery_state === "delivery_active")
      .sort((a, b) => {
        const rank = (row: DeliveryQueueRow) => row.delivery_state === "delivery_failed" ? 3 : row.delivery_state === "delivered_pod_pending" ? 2 : 1;
        return rank(b) - rank(a) || b.updated_at.localeCompare(a.updated_at);
      })
      .slice(0, 40)
      .map((row) => ({
        reference: row.reference,
        customerName: row.customer_name,
        route: `${row.origin} → ${row.destination}`,
        mode: row.mode,
        primaryBranch: row.primary_branch,
        shipmentStatus: row.status,
        deliveryState: row.delivery_state,
        attemptCount: row.attempt_count,
        lastAttemptStatus: row.last_attempt_status,
        lastAttemptAt: row.last_attempt_at,
        nextDeliveryAt: row.next_delivery_at,
        podStatus: row.pod_status,
        podEvidenceCount: row.pod_evidence_count,
        recipientName: row.recipient_name,
        currentLocation: row.current_location,
        updatedAt: row.updated_at,
      }));
    return gptActionJson({
      ok: true,
      generatedAt: new Date().toISOString(),
      sampledShipmentCount: snapshot.size,
      deliveryShipmentCount: rows.length,
      summary,
      attentionCount: attention.length,
      attention,
      privacy: "POD file paths, signed download URLs and binary evidence are intentionally excluded from Custom GPT responses.",
    });
  } catch (error) {
    console.error("KCPL Custom GPT delivery briefing failed", error);
    return gptActionJson({ ok: false, error: "The KCPL delivery briefing is temporarily unavailable." }, 503);
  }
}
