import { createHash, randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import type { KcplStaffRole } from "../staff-permissions";
import {
  automationAlertSeverities,
  automationAlertStatuses,
  automationAlertTypes,
  type AutomationAlert,
  type AutomationAlertSeverity,
  type AutomationAlertStatus,
  type AutomationAlertType,
} from "./alert-data";

const MAX_BATCH_WRITES = 400;
const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;

type Actor = { name: string; email: string };
type Candidate = Omit<AutomationAlert, "id" | "status" | "first_triggered_at" | "last_triggered_at" | "acknowledged_at" | "acknowledged_by_name" | "acknowledged_by_email" | "resolved_at" | "resolved_by_name" | "resolved_by_email">;
type BatchOperation = (batch: FirebaseFirestore.WriteBatch) => void;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function branchArray(value: unknown) {
  if (!Array.isArray(value)) return [] as KcplBranch[];
  return [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))];
}

function shipmentBranches(data: Record<string, unknown>) {
  const primary = branchValue(data.primary_branch);
  return [...new Set([...(primary ? [primary] : []), ...branchArray(data.handling_branches)])];
}

function alertType(value: unknown): AutomationAlertType {
  return automationAlertTypes.includes(value as AutomationAlertType) ? value as AutomationAlertType : "job_task_overdue";
}

function severity(value: unknown): AutomationAlertSeverity {
  return automationAlertSeverities.includes(value as AutomationAlertSeverity) ? value as AutomationAlertSeverity : "warning";
}

function status(value: unknown): AutomationAlertStatus {
  return automationAlertStatuses.includes(value as AutomationAlertStatus) ? value as AutomationAlertStatus : "open";
}

function roles(value: unknown): KcplStaffRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is KcplStaffRole => ["management", "accounts", "commercial", "operations"].includes(String(item)));
}

function fingerprintId(fingerprint: string) {
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 40);
}

function alertFromDoc(id: string, data: Record<string, unknown>): AutomationAlert {
  const entityType = text(data.entity_type);
  return {
    id,
    fingerprint: text(data.fingerprint, id),
    type: alertType(data.type),
    severity: severity(data.severity),
    status: status(data.status),
    title: text(data.title, "KCPL alert"),
    detail: text(data.detail),
    entity_type: ["shipment", "quote", "customer", "task", "invoice", "payable"].includes(entityType) ? entityType as AutomationAlert["entity_type"] : "shipment",
    entity_id: text(data.entity_id),
    parent_reference: nullable(data.parent_reference),
    branch: branchValue(data.branch),
    assigned_to_name: nullable(data.assigned_to_name),
    assigned_to_email: nullable(data.assigned_to_email),
    target_roles: roles(data.target_roles),
    action_path: text(data.action_path, "/admin/command-centre"),
    first_triggered_at: text(data.first_triggered_at),
    last_triggered_at: text(data.last_triggered_at),
    escalated_at: nullable(data.escalated_at),
    acknowledged_at: nullable(data.acknowledged_at),
    acknowledged_by_name: nullable(data.acknowledged_by_name),
    acknowledged_by_email: nullable(data.acknowledged_by_email),
    resolved_at: nullable(data.resolved_at),
    resolved_by_name: nullable(data.resolved_by_name),
    resolved_by_email: nullable(data.resolved_by_email),
  };
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateOnlyMs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function daysOverdue(dueDate: string, today: string) {
  const dueMs = dateOnlyMs(dueDate);
  const todayMs = dateOnlyMs(today);
  return Number.isFinite(dueMs) && Number.isFinite(todayMs)
    ? Math.max(1, Math.floor((todayMs - dueMs) / 86_400_000))
    : 1;
}

function parseOperationalDateTime(value: string) {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return Date.parse(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return Date.parse(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (dateCheck.getUTCFullYear() !== year || dateCheck.getUTCMonth() !== month - 1 || dateCheck.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return Number.NaN;
  return Date.UTC(year, month - 1, day, hour, minute, second) - NEPAL_OFFSET_MINUTES * 60_000;
}

function nepalDateTime(value: string) {
  const time = parseOperationalDateTime(value);
  if (!Number.isFinite(time)) return value;
  return `${new Intl.DateTimeFormat("en-AU", { timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short" }).format(new Date(time))} NPT`;
}

function shipmentIdFromChild(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

function candidate(input: Omit<Candidate, "fingerprint"> & { fingerprint: string }): Candidate {
  return input;
}

async function commitOperations(operations: BatchOperation[]) {
  const db = firebaseAdminDb();
  for (let index = 0; index < operations.length; index += MAX_BATCH_WRITES) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + MAX_BATCH_WRITES)) operation(batch);
    await batch.commit();
  }
}

async function shipmentBranchesForAlerts(alerts: AutomationAlert[]) {
  const db = firebaseAdminDb();
  const references = [...new Set(alerts.flatMap((alert) => alert.entity_type === "shipment" && alert.parent_reference ? [alert.parent_reference] : []))];
  const result = new Map<string, KcplBranch[]>();
  for (let index = 0; index < references.length; index += 250) {
    const chunk = references.slice(index, index + 250);
    const snapshots = await db.getAll(...chunk.map((reference) => db.collection("shipments").doc(reference)));
    for (const snapshot of snapshots) {
      if (snapshot.exists) result.set(snapshot.id, shipmentBranches(snapshot.data() as Record<string, unknown>));
    }
  }
  return result;
}

export async function evaluateAutomationRules() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, quotesSnapshot, customersSnapshot, invoicesSnapshot, tasksSnapshot, customsSnapshot, existingAlertsSnapshot] = await Promise.all([
    db.collection("shipments").limit(2500).get(),
    db.collection("quotes").limit(3000).get(),
    db.collection("customers").limit(3000).get(),
    db.collection("invoices").limit(4000).get(),
    db.collectionGroup("job_tasks").limit(10000).get(),
    db.collectionGroup("customs_steps").limit(7000).get(),
    db.collection("alerts").limit(5000).get(),
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const today = operationalDate(now);
  const shipments = new Map(shipmentsSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const quotes = new Map(quotesSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const customers = new Map(customersSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const customsOpen = new Map<string, number>();
  for (const doc of customsSnapshot.docs) {
    if (doc.get("required") === false || doc.get("completed") === true) continue;
    const shipmentId = shipmentIdFromChild(doc.ref);
    if (shipmentId) customsOpen.set(shipmentId, (customsOpen.get(shipmentId) ?? 0) + 1);
  }

  const candidates = new Map<string, Candidate>();

  for (const doc of tasksSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.completed === true) continue;
    const dueAt = nullable(data.due_at);
    if (!dueAt) continue;
    const dueMs = parseOperationalDateTime(dueAt);
    if (!Number.isFinite(dueMs) || dueMs >= nowMs) continue;
    const shipmentId = shipmentIdFromChild(doc.ref);
    if (!shipmentId) continue;
    const overdueHours = Math.max(0, (nowMs - dueMs) / 3_600_000);
    const isEscalated = overdueHours >= 24;
    const fingerprint = `job-task-overdue:${shipmentId}:${doc.id}`;
    candidates.set(fingerprint, candidate({
      fingerprint,
      type: "job_task_overdue",
      severity: isEscalated ? "critical" : "warning",
      title: isEscalated ? `Task overdue 24h+: ${text(data.title, "Operational task")}` : `Task overdue: ${text(data.title, "Operational task")}`,
      detail: `${shipmentId} · due ${nepalDateTime(dueAt)}${text(data.assigned_to_name) ? ` · ${text(data.assigned_to_name)}` : ""}`,
      entity_type: "task",
      entity_id: doc.id,
      parent_reference: shipmentId,
      branch: branchValue(data.branch),
      assigned_to_name: nullable(data.assigned_to_name),
      assigned_to_email: nullable(data.assigned_to_email),
      target_roles: isEscalated ? ["management", "operations"] : ["management", "operations", "commercial", "accounts"],
      action_path: `/admin/jobs/${encodeURIComponent(shipmentId)}`,
      escalated_at: isEscalated ? nowIso : null,
    }));
  }

  for (const [reference, data] of shipments) {
    const shipmentStatus = text(data.status);
    const branch = branchValue(data.primary_branch);
    const assignedName = nullable(data.job_assigned_to_name);
    const assignedEmail = nullable(data.job_assigned_to_email);
    if (shipmentStatus === "exception") {
      const fingerprint = `shipment-exception:${reference}`;
      candidates.set(fingerprint, candidate({
        fingerprint,
        type: "shipment_exception",
        severity: "critical",
        title: `Shipment exception: ${reference}`,
        detail: `${nullable(data.current_location) ?? "Location not updated"}${nullable(data.customer_note) ? ` · ${nullable(data.customer_note)}` : ""}`,
        entity_type: "shipment",
        entity_id: reference,
        parent_reference: reference,
        branch,
        assigned_to_name: assignedName,
        assigned_to_email: assignedEmail,
        target_roles: ["management", "operations", "commercial"],
        action_path: `/admin/jobs/${encodeURIComponent(reference)}`,
        escalated_at: nowIso,
      }));
    }

    const eta = nullable(data.eta);
    const openCustoms = customsOpen.get(reference) ?? 0;
    if (shipmentStatus !== "delivered" && eta?.slice(0, 10) === today && openCustoms > 0) {
      const fingerprint = `eta-customs-blocked:${reference}:${today}`;
      candidates.set(fingerprint, candidate({
        fingerprint,
        type: "eta_customs_blocked",
        severity: "critical",
        title: `ETA today with customs incomplete: ${reference}`,
        detail: `${openCustoms} required customs step${openCustoms === 1 ? "" : "s"} still open.`,
        entity_type: "shipment",
        entity_id: reference,
        parent_reference: reference,
        branch,
        assigned_to_name: assignedName,
        assigned_to_email: assignedEmail,
        target_roles: ["management", "operations"],
        action_path: `/admin/jobs/${encodeURIComponent(reference)}`,
        escalated_at: nowIso,
      }));
    }
  }

  const staleThreshold = nowMs - 48 * 60 * 60 * 1000;
  for (const [reference, data] of quotes) {
    if (["won", "lost"].includes(text(data.status))) continue;
    const updatedAt = nullable(data.updated_at) ?? nullable(data.created_at);
    if (!updatedAt) continue;
    const updatedMs = Date.parse(updatedAt);
    if (!Number.isFinite(updatedMs) || updatedMs >= staleThreshold) continue;
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) : undefined;
    const branch = branchValue(customer?.primary_branch);
    const fingerprint = `quote-stale:${reference}`;
    candidates.set(fingerprint, candidate({
      fingerprint,
      type: "quote_stale",
      severity: "warning",
      title: `Quote untouched for 48h+: ${reference}`,
      detail: `${text(data.origin, "Origin")} → ${text(data.destination, "Destination")} · ${text(data.company_name, text(data.contact_name, "Customer"))}`,
      entity_type: "quote",
      entity_id: reference,
      parent_reference: null,
      branch,
      assigned_to_name: nullable(data.assigned_to),
      assigned_to_email: null,
      target_roles: ["management", "commercial", "operations"],
      action_path: `/admin?quote=${encodeURIComponent(reference)}`,
      escalated_at: null,
    }));
  }

  for (const doc of invoicesSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const currentStatus = text(data.status);
    if (["draft", "paid", "void"].includes(currentStatus)) continue;
    const balanceDue = numberValue(data.balance_due);
    const dueDate = nullable(data.due_date);
    if (!dueDate || balanceDue <= 0 || dueDate >= today) continue;
    const overdue = daysOverdue(dueDate, today);
    const isCritical = overdue > 30;
    const fingerprint = `invoice-overdue:${doc.id}`;
    candidates.set(fingerprint, candidate({
      fingerprint,
      type: "invoice_overdue",
      severity: isCritical ? "critical" : "warning",
      title: `${isCritical ? "Receivable overdue 30d+" : "Invoice overdue"}: ${doc.id}`,
      detail: `${text(data.currency, "NPR")} ${balanceDue.toLocaleString("en-AU")} outstanding · due ${dueDate} · ${overdue} day${overdue === 1 ? "" : "s"} overdue · ${text(data.customer_name, text(data.customer_id, "Customer"))}`,
      entity_type: "invoice",
      entity_id: doc.id,
      parent_reference: nullable(data.shipment_reference),
      branch: branchValue(data.branch),
      assigned_to_name: null,
      assigned_to_email: null,
      target_roles: ["management", "accounts"],
      action_path: `/admin/finance/invoices/${encodeURIComponent(doc.id)}`,
      escalated_at: isCritical ? nowIso : null,
    }));
  }

  const creditHoldOperations: BatchOperation[] = [];
  let creditHolds = 0;
  for (const [customerId, data] of customers) {
    if (data.archived === true || text(data.account_status) === "blacklisted") continue;
    const limit = numberValue(data.credit_limit);
    const outstanding = numberValue(data.outstanding_balance);
    if (limit <= 0 || outstanding <= limit) continue;
    const fingerprint = `credit-limit-exceeded:${customerId}`;
    candidates.set(fingerprint, candidate({
      fingerprint,
      type: "credit_limit_exceeded",
      severity: "critical",
      title: `Credit limit exceeded: ${text(data.display_name, customerId)}`,
      detail: `${text(data.preferred_currency, "NPR")} ${outstanding.toLocaleString("en-AU")} outstanding against ${limit.toLocaleString("en-AU")} limit.`,
      entity_type: "customer",
      entity_id: customerId,
      parent_reference: null,
      branch: branchValue(data.primary_branch),
      assigned_to_name: nullable(data.account_manager_name),
      assigned_to_email: nullable(data.account_manager_email),
      target_roles: ["management", "accounts", "commercial"],
      action_path: `/admin/crm/${encodeURIComponent(customerId)}`,
      escalated_at: nowIso,
    }));
    if (text(data.account_status) !== "on_hold") {
      const customerRef = db.collection("customers").doc(customerId);
      creditHoldOperations.push((batch) => batch.update(customerRef, { account_status: "on_hold", updated_at: nowIso, credit_hold_automation_at: nowIso }));
      creditHoldOperations.push((batch) => batch.create(customerRef.collection("activity").doc(`activity-${Date.now()}-${randomBytes(4).toString("hex")}`), {
        type: "credit_hold_automatic",
        title: "Account automatically placed On Hold",
        detail: "Outstanding balance exceeded the configured credit limit.",
        actor_name: "KCPL Automation",
        actor_email: null,
        created_at: nowIso,
      }));
      creditHolds += 1;
    }
  }
  await commitOperations(creditHoldOperations);

  const existing = new Map(existingAlertsSnapshot.docs.map((doc) => [text(doc.get("fingerprint"), doc.id), alertFromDoc(doc.id, doc.data() as Record<string, unknown>)]));
  const alertOperations: BatchOperation[] = [];
  let created = 0;
  let updated = 0;
  let resolved = 0;

  for (const [fingerprint, next] of candidates) {
    const id = fingerprintId(fingerprint);
    const ref = db.collection("alerts").doc(id);
    const previous = existing.get(fingerprint);
    const escalated = next.severity === "critical" && (!previous || previous.severity !== "critical" || previous.status === "resolved");
    const preserveAcknowledgement = Boolean(previous && previous.status !== "resolved" && !escalated);
    alertOperations.push((batch) => batch.set(ref, {
      ...next,
      fingerprint,
      status: preserveAcknowledgement ? previous!.status : "open",
      first_triggered_at: previous?.first_triggered_at || nowIso,
      last_triggered_at: nowIso,
      escalated_at: escalated ? nowIso : previous?.escalated_at ?? next.escalated_at ?? null,
      acknowledged_at: preserveAcknowledgement ? previous?.acknowledged_at ?? null : null,
      acknowledged_by_name: preserveAcknowledgement ? previous?.acknowledged_by_name ?? null : null,
      acknowledged_by_email: preserveAcknowledgement ? previous?.acknowledged_by_email ?? null : null,
      resolved_at: null,
      resolved_by_name: null,
      resolved_by_email: null,
      source: "automation",
    }, { merge: true }));
    previous ? updated += 1 : created += 1;
  }

  for (const [fingerprint, previous] of existing) {
    if (previous.status === "resolved" || candidates.has(fingerprint)) continue;
    const ref = db.collection("alerts").doc(previous.id);
    alertOperations.push((batch) => batch.update(ref, {
      status: "resolved",
      resolved_at: nowIso,
      resolved_by_name: "KCPL Automation",
      resolved_by_email: null,
      last_triggered_at: nowIso,
    }));
    resolved += 1;
  }
  await commitOperations(alertOperations);
  return { kind: "completed" as const, created, updated, resolved, credit_holds: creditHolds, active: candidates.size };
}

function visibleToContext(alert: AutomationAlert, context: KcplStaffContext, email: string, shipmentBranchMap?: Map<string, KcplBranch[]>) {
  if (!alert.target_roles.includes(context.permissions.role)) return false;
  if (context.permissions.role === "management" && context.can_access_all_branches) return true;
  if (alert.assigned_to_email && alert.assigned_to_email.toLowerCase() === email.toLowerCase()) return true;
  if (alert.entity_type === "shipment" && alert.parent_reference) {
    const branches = shipmentBranchMap?.get(alert.parent_reference) ?? (alert.branch ? [alert.branch] : []);
    return branches.some((branch) => staffCanAccessBranch(context, branch));
  }
  if (!alert.branch) return context.permissions.role === "management" || context.permissions.role === "accounts" || context.permissions.role === "commercial";
  return staffCanAccessBranch(context, alert.branch);
}

export async function listAutomationAlerts(context: KcplStaffContext, email: string, includeResolved = false) {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("alerts").orderBy("last_triggered_at", "desc").limit(1000).get();
  const alerts = snapshot.docs.map((doc) => alertFromDoc(doc.id, doc.data() as Record<string, unknown>));
  const shipmentBranchMap = await shipmentBranchesForAlerts(alerts);
  return alerts
    .filter((alert) => (includeResolved || alert.status !== "resolved") && visibleToContext(alert, context, email, shipmentBranchMap))
    .sort((a, b) => {
      const severityScore = (value: AutomationAlertSeverity) => value === "critical" ? 3 : value === "warning" ? 2 : 1;
      return severityScore(b.severity) - severityScore(a.severity) || b.last_triggered_at.localeCompare(a.last_triggered_at);
    });
}

export async function updateAutomationAlert(alertId: string, nextStatus: "acknowledged" | "resolved", actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const ref = db.collection("alerts").doc(alertId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const alert = alertFromDoc(snapshot.id, snapshot.data() as Record<string, unknown>);
  let shipmentBranchMap: Map<string, KcplBranch[]> | undefined;
  if (alert.entity_type === "shipment" && alert.parent_reference) shipmentBranchMap = await shipmentBranchesForAlerts([alert]);
  if (!visibleToContext(alert, context, actor.email, shipmentBranchMap)) return { kind: "forbidden" as const };
  const now = new Date().toISOString();
  if (nextStatus === "acknowledged") {
    if (alert.status === "resolved") return { kind: "invalid_state" as const };
    await ref.update({ status: "acknowledged", acknowledged_at: now, acknowledged_by_name: actor.name, acknowledged_by_email: actor.email });
  } else {
    await ref.update({ status: "resolved", resolved_at: now, resolved_by_name: actor.name, resolved_by_email: actor.email });
  }
  return { kind: "updated" as const };
}
