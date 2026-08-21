import { createHash, randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { recomputeCustomerFinance } from "../../finance/finance.server";
import { getMigrationBatch } from "../migration-batches.server";
import type { MigrationCreatedRecord } from "../migration-batches";
import type { MigrationRecoveryPlan, MigrationRecoveryResult, RecoveryRecordKind, RecoveryRecordPlan } from "./recovery-data";
import {
  batchStatusCanRecover,
  confirmationMatches,
  migrationActivityOnly,
  migrationPaymentsOnly,
  migrationSeededChecklistOnly,
  recoveryConfirmationText,
  recoveryPlanMinutes,
  recoveryRecordKey,
  recordUntouched,
  sameMigrationBatch,
} from "./recovery-policy";

type Actor = { name: string; email: string };
type InspectContext = { batchId: string; reversed: Set<string> };

type RawBatch = {
  rollback_status?: unknown;
  rollback_reversed_record_keys?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stateToken(value: unknown) {
  return hash(value).slice(0, 32);
}

function recordHref(kind: RecoveryRecordKind, id: string) {
  const reference = encodeURIComponent(id);
  if (kind === "customer") return `/admin/crm/${reference}`;
  if (kind === "shipment") return `/admin/jobs/${reference}`;
  if (kind === "receivable") return `/admin/finance/invoices/${reference}`;
  return `/admin/payables/bills/${reference}`;
}

function archiveEntityType(kind: RecoveryRecordKind) {
  return kind;
}

async function archiveRefs(kind: RecoveryRecordKind, id: string) {
  const snapshot = await firebaseAdminDb().collection("paper_archive").where("entity_reference", "==", id).limit(100).get();
  return snapshot.docs.filter((doc) => text(doc.get("entity_type")) === archiveEntityType(kind));
}

function planRecord(kind: RecoveryRecordKind, id: string, status: RecoveryRecordPlan["status"], reasons: string[], archiveRelinks: number, tokenValue: unknown): RecoveryRecordPlan {
  return {
    key: recoveryRecordKey(kind, id),
    kind,
    id,
    href: recordHref(kind, id),
    status,
    reasons,
    archive_relinks: archiveRelinks,
    state_token: stateToken(tokenValue),
  };
}

async function inspectCustomer(id: string, context: InspectContext) {
  const key = recoveryRecordKey("customer", id);
  const ref = firebaseAdminDb().collection("customers").doc(id);
  const snapshot = await ref.get();
  const archives = await archiveRefs("customer", id);
  if (!snapshot.exists) {
    return planRecord("customer", id, context.reversed.has(key) ? "already_reversed" : "missing", context.reversed.has(key) ? ["Already reversed by an earlier Stage 4C recovery run."] : ["Customer record is missing, so ownership cannot be proven."], archives.length, { missing: true, reversed: context.reversed.has(key) });
  }
  const data = snapshot.data() ?? {};
  const reasons: string[] = [];
  if (!sameMigrationBatch(context.batchId, data.migration_batch_id)) reasons.push("Customer no longer carries this migration batch ID.");
  if (!recordUntouched(data.created_at, data.updated_at)) reasons.push("Customer was edited after import.");

  const [shipments, invoices, quotes, payables, contacts, addresses, notes, tasks, activity] = await Promise.all([
    firebaseAdminDb().collection("shipments").where("customer_id", "==", id).limit(1).get(),
    firebaseAdminDb().collection("invoices").where("customer_id", "==", id).limit(1).get(),
    firebaseAdminDb().collection("quotes").where("customer_id", "==", id).limit(1).get(),
    firebaseAdminDb().collection("payables").where("customer_id", "==", id).limit(1).get(),
    ref.collection("contacts").limit(1).get(),
    ref.collection("addresses").limit(1).get(),
    ref.collection("notes").limit(1).get(),
    ref.collection("tasks").limit(1).get(),
    ref.collection("activity").limit(5).get(),
  ]);
  if (!shipments.empty) reasons.push("Customer has shipment dependencies.");
  if (!invoices.empty) reasons.push("Customer has receivable dependencies.");
  if (!quotes.empty) reasons.push("Customer has enquiry/quote dependencies.");
  if (!payables.empty) reasons.push("Customer has payable dependencies.");
  if (!contacts.empty || !addresses.empty || !notes.empty || !tasks.empty) reasons.push("Customer has CRM child records created after import.");
  const activitySafe = activity.size === 1 && text(activity.docs[0]?.get("type")) === "customer_created";
  if (!activitySafe) reasons.push("Customer activity history is no longer the untouched Stage 1 creation state.");

  return planRecord("customer", id, reasons.length ? "blocked" : "eligible", reasons, archives.length, {
    batch: data.migration_batch_id,
    created: data.created_at,
    updated: data.updated_at,
    dependencyCounts: [shipments.size, invoices.size, quotes.size, payables.size, contacts.size, addresses.size, notes.size, tasks.size, activity.size],
    activityTypes: activity.docs.map((doc) => text(doc.get("type"))),
    archiveIds: archives.map((doc) => doc.id).sort(),
  });
}

async function inspectShipment(id: string, context: InspectContext) {
  const key = recoveryRecordKey("shipment", id);
  const ref = firebaseAdminDb().collection("shipments").doc(id);
  const snapshot = await ref.get();
  const archives = await archiveRefs("shipment", id);
  if (!snapshot.exists) {
    return planRecord("shipment", id, context.reversed.has(key) ? "already_reversed" : "missing", context.reversed.has(key) ? ["Already reversed by an earlier Stage 4C recovery run."] : ["Shipment record is missing, so ownership cannot be proven."], archives.length, { missing: true, reversed: context.reversed.has(key) });
  }
  const data = snapshot.data() ?? {};
  const reasons: string[] = [];
  if (!sameMigrationBatch(context.batchId, data.migration_batch_id)) reasons.push("Shipment no longer carries this migration batch ID.");
  const historical = data.migration_historical === true;
  const untouchedTime = historical
    ? text(data.updated_at) && text(data.updated_at) === text(data.job_closed_at) && text(data.status_changed_at) === text(data.job_closed_at)
    : text(data.migration_imported_at) && text(data.updated_at) === text(data.migration_imported_at) && text(data.status_changed_at) === text(data.migration_imported_at) && !text(data.job_closed_at);
  if (!untouchedTime) reasons.push("Shipment lifecycle changed after import.");

  const quoteReference = text(data.quote_reference);
  const [invoices, payables, documents, costs, activity, events, tasks, customs, requirements, quote] = await Promise.all([
    firebaseAdminDb().collection("invoices").where("shipment_reference", "==", id).limit(1).get(),
    firebaseAdminDb().collection("payables").where("shipment_reference", "==", id).limit(1).get(),
    ref.collection("documents").limit(1).get(),
    ref.collection("job_costs").limit(1).get(),
    ref.collection("job_activity").limit(1000).get(),
    ref.collection("events").limit(3).get(),
    ref.collection("job_tasks").limit(1000).get(),
    ref.collection("customs_steps").limit(1000).get(),
    ref.collection("document_requirements").limit(1000).get(),
    quoteReference ? firebaseAdminDb().collection("quotes").doc(quoteReference).get() : Promise.resolve(null),
  ]);
  if (!invoices.empty) reasons.push("Shipment has receivable dependencies.");
  if (!payables.empty) reasons.push("Shipment has payable dependencies.");
  if (!documents.empty) reasons.push("Shipment has uploaded documents.");
  if (!costs.empty) reasons.push("Shipment has Job File costs.");
  if (!migrationActivityOnly(activity.docs.map((doc) => doc.data()), context.batchId)) reasons.push("Shipment has post-import Job File activity.");
  if (events.size !== 1 || !text(events.docs[0]?.get("details")).includes(context.batchId)) reasons.push("Shipment event history changed after import.");
  if (!migrationSeededChecklistOnly(tasks.docs.map((doc) => doc.data()))) reasons.push("Shipment tasks were changed, completed or extended after import.");
  if (!migrationSeededChecklistOnly(customs.docs.map((doc) => doc.data()))) reasons.push("Customs checklist was changed, completed or extended after import.");
  const requirementsSafe = requirements.docs.every((doc) => doc.get("migration_seeded") === true && text(doc.get("created_at")) === text(doc.get("updated_at")));
  if (!requirementsSafe) reasons.push("Document requirements changed after import.");
  if (!quoteReference || !quote || !quote.exists || !sameMigrationBatch(context.batchId, quote.get("migration_batch_id"))) reasons.push("Migration-created hidden quote is missing or no longer belongs to this batch.");

  return planRecord("shipment", id, reasons.length ? "blocked" : "eligible", reasons, archives.length, {
    batch: data.migration_batch_id,
    updated: data.updated_at,
    statusChanged: data.status_changed_at,
    closed: data.job_closed_at,
    quoteReference,
    counts: [invoices.size, payables.size, documents.size, costs.size, activity.size, events.size, tasks.size, customs.size, requirements.size],
    activityIds: activity.docs.map((doc) => doc.id).sort(),
    eventIds: events.docs.map((doc) => doc.id).sort(),
    taskState: tasks.docs.map((doc) => [doc.id, doc.get("completed"), doc.get("migration_seeded")]),
    customsState: customs.docs.map((doc) => [doc.id, doc.get("completed"), doc.get("migration_seeded")]),
    requirementState: requirements.docs.map((doc) => [doc.id, doc.get("created_at"), doc.get("updated_at"), doc.get("migration_seeded")]),
    archiveIds: archives.map((doc) => doc.id).sort(),
  });
}

async function inspectReceivable(id: string, context: InspectContext) {
  const key = recoveryRecordKey("receivable", id);
  const ref = firebaseAdminDb().collection("invoices").doc(id);
  const snapshot = await ref.get();
  const archives = await archiveRefs("receivable", id);
  if (!snapshot.exists) {
    return planRecord("receivable", id, context.reversed.has(key) ? "already_reversed" : "missing", context.reversed.has(key) ? ["Already reversed by an earlier Stage 4C recovery run."] : ["Receivable is missing, so ownership cannot be proven."], archives.length, { missing: true, reversed: context.reversed.has(key) });
  }
  const data = snapshot.data() ?? {};
  const reasons: string[] = [];
  if (!sameMigrationBatch(context.batchId, data.migration_batch_id)) reasons.push("Receivable no longer carries this migration batch ID.");
  if (!recordUntouched(data.created_at, data.updated_at)) reasons.push("Receivable was edited or recalculated after import.");
  const payments = await ref.collection("payments").limit(500).get();
  if (!migrationPaymentsOnly(payments.docs.map((doc) => doc.data()), context.batchId)) reasons.push("Receivable has post-migration payment activity.");
  return planRecord("receivable", id, reasons.length ? "blocked" : "eligible", reasons, archives.length, {
    batch: data.migration_batch_id,
    created: data.created_at,
    updated: data.updated_at,
    paymentState: payments.docs.map((doc) => [doc.id, doc.get("migration_batch_id"), doc.get("amount")]),
    archiveIds: archives.map((doc) => doc.id).sort(),
  });
}

async function inspectPayable(id: string, context: InspectContext) {
  const key = recoveryRecordKey("payable", id);
  const ref = firebaseAdminDb().collection("payables").doc(id);
  const snapshot = await ref.get();
  const archives = await archiveRefs("payable", id);
  if (!snapshot.exists) {
    return planRecord("payable", id, context.reversed.has(key) ? "already_reversed" : "missing", context.reversed.has(key) ? ["Already reversed by an earlier Stage 4C recovery run."] : ["Payable is missing, so ownership cannot be proven."], archives.length, { missing: true, reversed: context.reversed.has(key) });
  }
  const data = snapshot.data() ?? {};
  const reasons: string[] = [];
  if (!sameMigrationBatch(context.batchId, data.migration_batch_id)) reasons.push("Payable no longer carries this migration batch ID.");
  if (!recordUntouched(data.created_at, data.updated_at)) reasons.push("Payable was edited or recalculated after import.");
  const payments = await ref.collection("payments").limit(500).get();
  if (!migrationPaymentsOnly(payments.docs.map((doc) => doc.data()), context.batchId)) reasons.push("Payable has post-migration payment activity.");

  let costState: unknown = null;
  const shipmentReference = text(data.shipment_reference);
  const recordType = text(data.record_type);
  if (recordType === "bill" && shipmentReference) {
    const cost = await firebaseAdminDb().collection("shipments").doc(shipmentReference).collection("job_costs").doc(`payable_${id}`).get();
    costState = cost.exists ? [cost.id, cost.get("migration_batch_id"), cost.get("source_reference"), cost.get("locked")] : null;
    if (!cost.exists || !sameMigrationBatch(context.batchId, cost.get("migration_batch_id")) || text(cost.get("source_reference")) !== id) reasons.push("Migration-created Job File cost is missing or changed.");
  }

  return planRecord("payable", id, reasons.length ? "blocked" : "eligible", reasons, archives.length, {
    batch: data.migration_batch_id,
    created: data.created_at,
    updated: data.updated_at,
    paymentState: payments.docs.map((doc) => [doc.id, doc.get("migration_batch_id"), doc.get("amount")]),
    shipmentReference,
    costState,
    archiveIds: archives.map((doc) => doc.id).sort(),
  });
}

async function inspectRecord(record: MigrationCreatedRecord, context: InspectContext): Promise<RecoveryRecordPlan> {
  if (record.kind === "customer") return inspectCustomer(record.id, context);
  if (record.kind === "shipment") return inspectShipment(record.id, context);
  if (record.kind === "receivable") return inspectReceivable(record.id, context);
  return inspectPayable(record.id, context);
}

function digestPlan(batchId: string, batchStatus: string, rollbackStatus: string | null, records: RecoveryRecordPlan[]) {
  return hash({
    version: 1,
    batchId,
    batchStatus,
    rollbackStatus,
    records: records.map((record) => ({ key: record.key, status: record.status, reasons: record.reasons, archive_relinks: record.archive_relinks, state_token: record.state_token })),
  });
}

async function buildPlanSnapshot(batchIdValue: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const batchId = batchIdValue.trim().toUpperCase();
  const batch = await getMigrationBatch(batchId);
  if (!batch) return { kind: "missing" as const };
  const rawSnapshot = await firebaseAdminDb().collection("migration_batches").doc(batchId).get();
  const raw = (rawSnapshot.data() ?? {}) as RawBatch;
  const rollbackStatus = text(raw.rollback_status) || null;
  const reversed = new Set(stringArray(raw.rollback_reversed_record_keys));
  const records = await Promise.all(batch.created_records.map((record) => inspectRecord(record, { batchId, reversed })));
  const eligible = records.filter((record) => record.status === "eligible").length;
  const blocked = records.filter((record) => record.status === "blocked").length;
  const already = records.filter((record) => record.status === "already_reversed").length;
  const missing = records.filter((record) => record.status === "missing").length;
  const recoverableStatus = batchStatusCanRecover(batch.status);
  const allAlready = records.length > 0 && already === records.length;
  const canExecute = recoverableStatus && rollbackStatus !== "completed" && blocked === 0 && missing === 0 && (eligible > 0 || (rollbackStatus === "partial_failure" && allAlready));
  const warnings: string[] = [];
  if (!recoverableStatus) warnings.push("Only completed, partial-failure or interrupted migration batches can enter recovery.");
  if (rollbackStatus === "completed") warnings.push("This batch has already been rolled back. Stage 4C never rolls the same batch back twice.");
  if (batch.status === "partial_failure" || batch.status === "interrupted") warnings.push("This recovery targets only records actually recorded in the batch inventory.");
  const archiveRelinks = records.reduce((sum, record) => sum + record.archive_relinks, 0);
  if (archiveRelinks) warnings.push(`${archiveRelinks} Paper Archive item${archiveRelinks === 1 ? "" : "s"} will be preserved and re-linked to this migration batch before source records are removed.`);
  if (!records.length) warnings.push("This batch has no authoritative created-record inventory, so automatic rollback is not allowed.");
  return {
    kind: "ready" as const,
    batch,
    rollbackStatus,
    records,
    canExecute,
    warnings,
    digest: digestPlan(batchId, batch.status, rollbackStatus, records),
  };
}

export async function prepareMigrationRecovery(batchIdValue: string, actor: Actor): Promise<{ kind: "unavailable" | "missing" } | { kind: "ready"; plan: MigrationRecoveryPlan }> {
  const snapshot = await buildPlanSnapshot(batchIdValue);
  if (snapshot.kind !== "ready") return snapshot;
  const now = new Date();
  const expires = new Date(now.getTime() + recoveryPlanMinutes * 60 * 1000);
  const planId = `REC-PLAN-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
  const batchId = snapshot.batch.id;
  const plan: MigrationRecoveryPlan = {
    plan_id: planId,
    plan_hash: snapshot.digest,
    batch_id: batchId,
    batch_type: snapshot.batch.type_label,
    batch_status: snapshot.batch.status,
    rollback_status: snapshot.rollbackStatus,
    generated_at: now.toISOString(),
    expires_at: expires.toISOString(),
    records: snapshot.records,
    eligible_count: snapshot.records.filter((record) => record.status === "eligible").length,
    blocked_count: snapshot.records.filter((record) => record.status === "blocked").length,
    already_reversed_count: snapshot.records.filter((record) => record.status === "already_reversed").length,
    missing_count: snapshot.records.filter((record) => record.status === "missing").length,
    archive_relinks: snapshot.records.reduce((sum, record) => sum + record.archive_relinks, 0),
    warnings: snapshot.warnings,
    can_execute: snapshot.canExecute,
    confirmation_text: recoveryConfirmationText(batchId),
  };
  await firebaseAdminDb().collection("migration_recovery_plans").doc(planId).create({
    schema_version: 1,
    plan_id: planId,
    batch_id: batchId,
    plan_hash: snapshot.digest,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: plan.generated_at,
    expires_at: plan.expires_at,
    can_execute: plan.can_execute,
    record_count: plan.records.length,
    eligible_count: plan.eligible_count,
    blocked_count: plan.blocked_count,
  });
  return { kind: "ready", plan };
}

async function rehomeArchives(kind: RecoveryRecordKind, id: string, batchId: string, recoveryId: string, actor: Actor) {
  const docs = await archiveRefs(kind, id);
  if (!docs.length) return 0;
  const batch = firebaseAdminDb().batch();
  const now = new Date().toISOString();
  for (const doc of docs) {
    batch.update(doc.ref, {
      recovery_original_entity_type: kind,
      recovery_original_entity_reference: id,
      recovery_original_entity_label: doc.get("entity_label") ?? null,
      recovery_id: recoveryId,
      recovery_relinked_at: now,
      recovery_relinked_by_name: actor.name,
      recovery_relinked_by_email: actor.email,
      entity_type: "migration_batch",
      entity_reference: batchId,
      entity_label: batchId,
    });
  }
  await batch.commit();
  return docs.length;
}

async function deleteMigrationActivity(collection: FirebaseFirestore.CollectionReference, batchId: string) {
  const snapshot = await collection.where("migration_batch_id", "==", batchId).limit(500).get();
  if (snapshot.empty) return;
  const batch = firebaseAdminDb().batch();
  for (const doc of snapshot.docs) batch.delete(doc.ref);
  await batch.commit();
}

async function recomputeShipmentCounts(customerId: string) {
  if (!customerId) return;
  const snapshot = await firebaseAdminDb().collection("shipments").where("customer_id", "==", customerId).limit(5000).get();
  let active = 0;
  let completed = 0;
  for (const doc of snapshot.docs) {
    if (text(doc.get("status")) === "delivered") completed += 1;
    else active += 1;
  }
  await firebaseAdminDb().collection("customers").doc(customerId).set({ active_shipment_count: active, completed_shipment_count: completed, updated_at: new Date().toISOString() }, { merge: true });
}

async function reverseCustomer(record: RecoveryRecordPlan, batchId: string, recoveryId: string, actor: Actor) {
  const ref = firebaseAdminDb().collection("customers").doc(record.id);
  const relinked = await rehomeArchives("customer", record.id, batchId, recoveryId, actor);
  await firebaseAdminDb().recursiveDelete(ref);
  return { relinked, customerId: null as string | null };
}

async function reverseShipment(record: RecoveryRecordPlan, batchId: string, recoveryId: string, actor: Actor) {
  const db = firebaseAdminDb();
  const ref = db.collection("shipments").doc(record.id);
  const snapshot = await ref.get();
  const customerId = text(snapshot.get("customer_id"));
  const quoteReference = text(snapshot.get("quote_reference"));
  const relinked = await rehomeArchives("shipment", record.id, batchId, recoveryId, actor);
  if (customerId) await deleteMigrationActivity(db.collection("customers").doc(customerId).collection("activity"), batchId);
  if (quoteReference) {
    const quote = await db.collection("quotes").doc(quoteReference).get();
    if (quote.exists && sameMigrationBatch(batchId, quote.get("migration_batch_id"))) await db.recursiveDelete(quote.ref);
  }
  await db.recursiveDelete(ref);
  if (customerId) await recomputeShipmentCounts(customerId);
  return { relinked, customerId };
}

async function reverseReceivable(record: RecoveryRecordPlan, batchId: string, recoveryId: string, actor: Actor) {
  const db = firebaseAdminDb();
  const ref = db.collection("invoices").doc(record.id);
  const snapshot = await ref.get();
  const customerId = text(snapshot.get("customer_id"));
  const shipmentReference = text(snapshot.get("shipment_reference"));
  const relinked = await rehomeArchives("receivable", record.id, batchId, recoveryId, actor);
  if (customerId) await deleteMigrationActivity(db.collection("customers").doc(customerId).collection("activity"), batchId);
  if (shipmentReference) await deleteMigrationActivity(db.collection("shipments").doc(shipmentReference).collection("job_activity"), batchId);
  await db.recursiveDelete(ref);
  if (customerId) await recomputeCustomerFinance(customerId);
  return { relinked, customerId };
}

async function reversePayable(record: RecoveryRecordPlan, batchId: string, recoveryId: string, actor: Actor) {
  const db = firebaseAdminDb();
  const ref = db.collection("payables").doc(record.id);
  const snapshot = await ref.get();
  const customerId = text(snapshot.get("customer_id"));
  const supplierId = text(snapshot.get("supplier_id"));
  const shipmentReference = text(snapshot.get("shipment_reference"));
  const recordType = text(snapshot.get("record_type"));
  const relinked = await rehomeArchives("payable", record.id, batchId, recoveryId, actor);
  if (supplierId) await deleteMigrationActivity(db.collection("partners").doc(supplierId).collection("activity"), batchId);
  if (shipmentReference) {
    await deleteMigrationActivity(db.collection("shipments").doc(shipmentReference).collection("job_activity"), batchId);
    if (recordType === "bill") await db.collection("shipments").doc(shipmentReference).collection("job_costs").doc(`payable_${record.id}`).delete();
  }
  await db.recursiveDelete(ref);
  if (customerId) await recomputeCustomerFinance(customerId);
  return { relinked, customerId };
}

async function reverseRecord(record: RecoveryRecordPlan, batchId: string, recoveryId: string, actor: Actor) {
  if (record.kind === "customer") return reverseCustomer(record, batchId, recoveryId, actor);
  if (record.kind === "shipment") return reverseShipment(record, batchId, recoveryId, actor);
  if (record.kind === "receivable") return reverseReceivable(record, batchId, recoveryId, actor);
  return reversePayable(record, batchId, recoveryId, actor);
}

export async function executeMigrationRecovery(input: { batchId: string; planId: string; planHash: string; confirmation: string }, actor: Actor): Promise<{ kind: "unavailable" | "missing" | "invalid" | "stale"; error?: string } | { kind: "completed"; result: MigrationRecoveryResult }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  const batchId = input.batchId.trim().toUpperCase();
  if (!confirmationMatches(batchId, input.confirmation)) return { kind: "invalid", error: `Type ${recoveryConfirmationText(batchId)} exactly to confirm.` };
  const planSnapshot = await firebaseAdminDb().collection("migration_recovery_plans").doc(input.planId).get();
  if (!planSnapshot.exists) return { kind: "missing", error: "Recovery plan not found. Run a new dry-run plan." };
  if (text(planSnapshot.get("batch_id")) !== batchId || text(planSnapshot.get("plan_hash")) !== input.planHash) return { kind: "invalid", error: "Recovery plan identity does not match this batch." };
  if (text(planSnapshot.get("created_by_email")).toLowerCase() !== actor.email.trim().toLowerCase()) return { kind: "invalid", error: "Recovery must be executed by the Management user who created the dry-run plan." };
  const expiresAt = Date.parse(text(planSnapshot.get("expires_at")));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return { kind: "stale", error: "Recovery plan expired. Run a fresh dry-run plan." };

  const current = await buildPlanSnapshot(batchId);
  if (current.kind !== "ready") return current.kind === "missing" ? { kind: "missing", error: "Migration batch not found." } : { kind: "unavailable", error: "Migration storage is unavailable." };
  if (current.digest !== input.planHash) return { kind: "stale", error: "KCPL data changed after the dry run. Nothing was deleted. Generate a new recovery plan." };
  if (!current.canExecute) return { kind: "invalid", error: "This batch currently has recovery blockers. Nothing was deleted." };

  const recoveryId = `REC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
  const recoveryRef = firebaseAdminDb().collection("migration_recoveries").doc(recoveryId);
  const batchRef = firebaseAdminDb().collection("migration_batches").doc(batchId);
  const startedAt = new Date().toISOString();
  const completedKeys: string[] = [];
  let archiveRelinks = 0;

  await recoveryRef.create({
    schema_version: 1,
    recovery_id: recoveryId,
    batch_id: batchId,
    plan_id: input.planId,
    plan_hash: input.planHash,
    status: "running",
    record_count: current.records.length,
    eligible_count: current.records.filter((record) => record.status === "eligible").length,
    already_reversed_count: current.records.filter((record) => record.status === "already_reversed").length,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: startedAt,
    completed_at: null,
    completed_record_keys: [],
    archive_relinks: 0,
  });
  await batchRef.set({
    rollback_status: "running",
    rollback_recovery_id: recoveryId,
    rollback_started_at: startedAt,
    rollback_by_name: actor.name,
    rollback_by_email: actor.email,
    rollback_error: null,
  }, { merge: true });
  await batchRef.collection("recovery_events").doc(recoveryId).create({ type: "recovery_started", recovery_id: recoveryId, actor_name: actor.name, actor_email: actor.email, created_at: startedAt, plan_hash: input.planHash });

  try {
    for (const planned of current.records.filter((record) => record.status === "eligible")) {
      const latestBatch = await batchRef.get();
      const reversed = new Set(stringArray(latestBatch.get("rollback_reversed_record_keys")));
      const fresh = await inspectRecord({ kind: planned.kind, id: planned.id, href: planned.href }, { batchId, reversed });
      if (fresh.status !== "eligible" || fresh.state_token !== planned.state_token) throw new Error(`${planned.kind} ${planned.id} changed during recovery. Recovery stopped before touching that record.`);
      const outcome = await reverseRecord(planned, batchId, recoveryId, actor);
      archiveRelinks += outcome.relinked;
      completedKeys.push(planned.key);
      await batchRef.set({ rollback_reversed_record_keys: FieldValue.arrayUnion(planned.key), rollback_archive_relinks: FieldValue.increment(outcome.relinked) }, { merge: true });
      await recoveryRef.set({ completed_record_keys: completedKeys, archive_relinks: archiveRelinks }, { merge: true });
    }

    const completedAt = new Date().toISOString();
    await batchRef.set({ rollback_status: "completed", rollback_completed_at: completedAt, rollback_error: null }, { merge: true });
    await batchRef.collection("recovery_events").doc(`${recoveryId}-completed`).create({ type: "recovery_completed", recovery_id: recoveryId, actor_name: actor.name, actor_email: actor.email, created_at: completedAt, reversed_count: completedKeys.length, archive_relinks: archiveRelinks });
    await recoveryRef.set({ status: "completed", completed_at: completedAt, completed_record_keys: completedKeys, archive_relinks: archiveRelinks }, { merge: true });
    const result: MigrationRecoveryResult = {
      recovery_id: recoveryId,
      batch_id: batchId,
      status: "completed",
      reversed_count: completedKeys.length,
      already_reversed_count: current.records.filter((record) => record.status === "already_reversed").length,
      archive_relinks: archiveRelinks,
      completed_record_keys: completedKeys,
      error: null,
      completed_at: completedAt,
    };
    return { kind: "completed", result };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Migration recovery failed.";
    const completedAt = new Date().toISOString();
    await batchRef.set({ rollback_status: "partial_failure", rollback_error: message, rollback_completed_at: completedAt }, { merge: true });
    await batchRef.collection("recovery_events").doc(`${recoveryId}-failed`).create({ type: "recovery_partial_failure", recovery_id: recoveryId, actor_name: actor.name, actor_email: actor.email, created_at: completedAt, completed_record_keys: completedKeys, archive_relinks: archiveRelinks, error: message });
    await recoveryRef.set({ status: "partial_failure", completed_at: completedAt, completed_record_keys: completedKeys, archive_relinks: archiveRelinks, error: message }, { merge: true });
    const result: MigrationRecoveryResult = {
      recovery_id: recoveryId,
      batch_id: batchId,
      status: "partial_failure",
      reversed_count: completedKeys.length,
      already_reversed_count: current.records.filter((record) => record.status === "already_reversed").length,
      archive_relinks: archiveRelinks,
      completed_record_keys: completedKeys,
      error: message,
      completed_at: completedAt,
    };
    return { kind: "completed", result };
  }
}
