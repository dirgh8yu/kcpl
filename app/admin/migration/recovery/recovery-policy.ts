export const recoveryPlanMinutes = 15;

export function recoveryConfirmationText(batchId: string) {
  return `ROLLBACK ${batchId.trim().toUpperCase()}`;
}

export function confirmationMatches(batchId: string, value: string) {
  return value.trim().toUpperCase() === recoveryConfirmationText(batchId);
}

export function batchStatusCanRecover(status: string) {
  return status === "completed" || status === "partial_failure" || status === "interrupted";
}

export function sameMigrationBatch(expectedBatchId: string, actualBatchId: unknown) {
  return typeof actualBatchId === "string" && actualBatchId.trim().toUpperCase() === expectedBatchId.trim().toUpperCase();
}

export function recordUntouched(createdAt: unknown, updatedAt: unknown) {
  return typeof createdAt === "string" && createdAt.length > 0 && typeof updatedAt === "string" && updatedAt === createdAt;
}

export function migrationPaymentsOnly(payments: Array<{ migration_batch_id?: unknown }>, batchId: string) {
  return payments.every((payment) => sameMigrationBatch(batchId, payment.migration_batch_id));
}

export function migrationSeededChecklistOnly(rows: Array<{ migration_seeded?: unknown; completed?: unknown }>) {
  return rows.every((row) => row.migration_seeded === true && row.completed !== true);
}

export function migrationActivityOnly(rows: Array<{ type?: unknown; detail?: unknown; migration_batch_id?: unknown }>, batchId: string) {
  if (rows.length !== 1) return false;
  const row = rows[0];
  if (sameMigrationBatch(batchId, row.migration_batch_id)) return true;
  const type = typeof row.type === "string" ? row.type : "";
  const detail = typeof row.detail === "string" ? row.detail : "";
  return (type === "active_shipment_imported" || type === "historical_shipment_imported") && detail.includes(batchId);
}

export function recoveryRecordKey(kind: string, id: string) {
  return `${kind}:${id}`;
}
