import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import type { MigrationBatchDashboard, MigrationBatchStatus, MigrationBatchSummary, MigrationCreatedRecord } from "./migration-batches";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item).trim()).filter(Boolean).slice(0, 5000);
}

function typeMeta(type: string, phase: string | null) {
  if (type === "customer_csv") return { stageLabel: "Stage 1", typeLabel: "Customers" };
  if (type === "shipment_csv") return { stageLabel: "Stage 2", typeLabel: "Shipments" };
  if (type === "receivables_csv" || phase === "3a") return { stageLabel: "Stage 3A", typeLabel: "Receivables" };
  if (type === "payables_csv" || phase === "3b") return { stageLabel: "Stage 3B", typeLabel: "Payables" };
  return { stageLabel: "Migration", typeLabel: type.replaceAll("_", " ") || "Unknown batch" };
}

function effectiveStatus(stored: string, createdAt: string, generatedAt: string): MigrationBatchStatus {
  if (stored === "completed") return "completed";
  if (stored === "partial_failure") return "partial_failure";
  if (stored === "running") {
    const createdMs = Date.parse(createdAt);
    const generatedMs = Date.parse(generatedAt);
    if (Number.isFinite(createdMs) && Number.isFinite(generatedMs) && generatedMs - createdMs > 30 * 60 * 1000) return "interrupted";
    return "running";
  }
  return "unknown";
}

function createdRecords(data: Record<string, unknown>): MigrationCreatedRecord[] {
  const output: MigrationCreatedRecord[] = [];
  for (const id of stringArray(data.created_customer_ids)) output.push({ kind: "customer", id, href: `/admin/crm/${encodeURIComponent(id)}` });
  for (const id of stringArray(data.created_shipment_references)) output.push({ kind: "shipment", id, href: `/admin/jobs/${encodeURIComponent(id)}` });
  for (const id of stringArray(data.created_receivable_references)) output.push({ kind: "receivable", id, href: `/admin/finance/invoices/${encodeURIComponent(id)}` });
  for (const id of stringArray(data.created_payable_references)) output.push({ kind: "payable", id, href: `/admin/payables/bills/${encodeURIComponent(id)}` });
  return output;
}

function detailMetrics(data: Record<string, unknown>) {
  const metrics: Array<{ label: string; value: number }> = [];
  const candidates: Array<[string, string]> = [
    ["active_imported", "Active shipments"],
    ["historical_imported", "Historical shipments"],
    ["invoice_rows_imported", "Invoices"],
    ["bill_rows_imported", "Supplier bills"],
    ["opening_balance_rows_imported", "Opening balances"],
  ];
  for (const [key, label] of candidates) {
    if (data[key] !== undefined) metrics.push({ label, value: numberValue(data[key]) });
  }
  return metrics;
}

function batchFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot, generatedAt: string): MigrationBatchSummary {
  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  const type = text(data.type, "unknown");
  const phase = nullable(data.phase);
  const meta = typeMeta(type, phase);
  const createdAt = text(data.created_at);
  const storedStatus = text(data.status, "unknown");
  return {
    id: text(data.batch_id, snapshot.id),
    stage_label: meta.stageLabel,
    type_label: meta.typeLabel,
    type,
    phase,
    status: effectiveStatus(storedStatus, createdAt, generatedAt),
    stored_status: storedStatus,
    source_filename: nullable(data.source_filename),
    total_rows: numberValue(data.total_rows),
    ready_rows: numberValue(data.ready_rows),
    duplicate_rows: numberValue(data.duplicate_rows),
    invalid_rows: numberValue(data.invalid_rows),
    imported_count: numberValue(data.imported_count),
    created_by_name: text(data.created_by_name, "KCPL Migration"),
    created_by_email: text(data.created_by_email),
    created_at: createdAt,
    completed_at: nullable(data.completed_at),
    error: nullable(data.error),
    created_records: createdRecords(data),
    detail_metrics: detailMetrics(data),
  };
}

export async function listMigrationBatches(): Promise<MigrationBatchDashboard | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const generatedAt = new Date().toISOString();
  const snapshot = await firebaseAdminDb().collection("migration_batches").orderBy("created_at", "desc").limit(500).get();
  const batches = snapshot.docs.map((doc) => batchFromSnapshot(doc, generatedAt));
  return {
    generated_at: generatedAt,
    batches,
    total_batches: batches.length,
    completed_batches: batches.filter((batch) => batch.status === "completed").length,
    partial_failure_batches: batches.filter((batch) => batch.status === "partial_failure").length,
    interrupted_batches: batches.filter((batch) => batch.status === "interrupted").length,
    imported_records: batches.reduce((sum, batch) => sum + batch.imported_count, 0),
  };
}

export async function getMigrationBatch(batchId: string): Promise<MigrationBatchSummary | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const generatedAt = new Date().toISOString();
  const snapshot = await firebaseAdminDb().collection("migration_batches").doc(batchId.trim().toUpperCase()).get();
  if (!snapshot.exists) return null;
  return batchFromSnapshot(snapshot, generatedAt);
}
