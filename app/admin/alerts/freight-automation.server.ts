import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../../shipment-document-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { defaultDocumentRequirements } from "../workflow-defaults";
import type { AutomationAlertSeverity, AutomationAlertType } from "./alert-data";

const EXTRA_TYPES: AutomationAlertType[] = [
  "shipment_unassigned",
  "eta_upcoming",
  "customs_open",
  "required_document_missing",
  "pod_missing",
  "shipment_stalled",
];
const ACTIVE_STATUSES = new Set(["booking_confirmed", "preparing", "in_transit", "customs_clearance", "out_for_delivery", "exception"]);
const MAX_BATCH_WRITES = 400;

type AlertCandidate = {
  fingerprint: string;
  type: AutomationAlertType;
  severity: AutomationAlertSeverity;
  title: string;
  detail: string;
  reference: string;
  branch: KcplBranch | null;
  assignedName: string | null;
  assignedEmail: string | null;
  escalated: boolean;
};

type AutoTaskCondition = {
  id: string;
  title: string;
  detail: string;
  branch: KcplBranch;
  assignedUid: string | null;
  assignedName: string | null;
  assignedEmail: string | null;
  assignedPhone: string | null;
  dueHours: number;
};

type BatchOperation = (batch: FirebaseFirestore.WriteBatch) => void;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function branches(value: unknown) {
  if (!Array.isArray(value)) return [] as KcplBranch[];
  return value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch));
}

function shipmentBranch(data: Record<string, unknown>) {
  return branchValue(data.primary_branch) ?? branches(data.handling_branches)[0] ?? null;
}

function childShipmentId(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

function alertId(fingerprint: string) {
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 40);
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateOnlyMs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function etaDays(eta: string, today: string) {
  const etaMs = dateOnlyMs(eta.slice(0, 10));
  const todayMs = dateOnlyMs(today);
  return Number.isFinite(etaMs) && Number.isFinite(todayMs) ? Math.round((etaMs - todayMs) / 86_400_000) : null;
}

function stalledHours(status: string) {
  if (status === "customs_clearance") return 24;
  if (status === "out_for_delivery") return 12;
  if (status === "in_transit") return 24 * 7;
  if (status === "booking_confirmed" || status === "preparing") return 48;
  return null;
}

function dueIso(now: Date, hours: number) {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}

async function commitOperations(operations: BatchOperation[]) {
  const db = firebaseAdminDb();
  for (let index = 0; index < operations.length; index += MAX_BATCH_WRITES) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + MAX_BATCH_WRITES)) operation(batch);
    await batch.commit();
  }
}

export async function evaluateFreightAutomation() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, quotesSnapshot, customsSnapshot, documentsSnapshot, requirementsSnapshot, autoTasksSnapshot, existingAlertsSnapshot] = await Promise.all([
    db.collection("shipments").limit(2500).get(),
    db.collection("quotes").limit(3000).get(),
    db.collectionGroup("customs_steps").limit(10000).get(),
    db.collectionGroup("documents").limit(15000).get(),
    db.collectionGroup("document_requirements").limit(5000).get(),
    db.collectionGroup("job_tasks").where("automation_generated", "==", true).limit(10000).get(),
    db.collection("alerts").limit(5000).get(),
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const today = operationalDate(now);
  const quotes = new Map(quotesSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));

  const customsByShipment = new Map<string, { total: number; completed: number; openTitles: string[] }>();
  for (const doc of customsSnapshot.docs) {
    if (doc.get("required") === false) continue;
    const reference = childShipmentId(doc.ref);
    if (!reference) continue;
    const current = customsByShipment.get(reference) ?? { total: 0, completed: 0, openTitles: [] };
    current.total += 1;
    if (doc.get("completed") === true) current.completed += 1;
    else current.openTitles.push(text(doc.get("title"), "Customs step"));
    customsByShipment.set(reference, current);
  }

  const documentsByShipment = new Map<string, Set<ShipmentDocumentType>>();
  for (const doc of documentsSnapshot.docs) {
    const reference = childShipmentId(doc.ref);
    const type = doc.get("document_type") as ShipmentDocumentType;
    if (!reference || !shipmentDocumentTypeLabels[type]) continue;
    const set = documentsByShipment.get(reference) ?? new Set<ShipmentDocumentType>();
    set.add(type);
    documentsByShipment.set(reference, set);
  }

  const requirementOverrides = new Map<string, Map<ShipmentDocumentType, boolean>>();
  for (const doc of requirementsSnapshot.docs) {
    const reference = childShipmentId(doc.ref);
    const type = (doc.get("document_type") || doc.id) as ShipmentDocumentType;
    if (!reference || !shipmentDocumentTypeLabels[type]) continue;
    const map = requirementOverrides.get(reference) ?? new Map<ShipmentDocumentType, boolean>();
    map.set(type, doc.get("required") === true);
    requirementOverrides.set(reference, map);
  }

  const candidates = new Map<string, AlertCandidate>();
  const tasksByShipment = new Map<string, AutoTaskCondition[]>();

  function addCandidate(input: AlertCandidate) {
    candidates.set(input.fingerprint, input);
  }

  function addTask(reference: string, task: AutoTaskCondition) {
    const tasks = tasksByShipment.get(reference) ?? [];
    tasks.push(task);
    tasksByShipment.set(reference, tasks);
  }

  for (const shipment of shipmentsSnapshot.docs) {
    const reference = shipment.id;
    const data = shipment.data() as Record<string, unknown>;
    const status = text(data.status, "booking_confirmed");
    const isActive = ACTIVE_STATUSES.has(status);
    const branch = shipmentBranch(data);
    const assignedUid = nullable(data.job_assigned_to_uid);
    const assignedName = nullable(data.job_assigned_to_name);
    const assignedEmail = nullable(data.job_assigned_to_email);
    const assignedPhone = nullable(data.job_assigned_to_phone);
    const quoteReference = nullable(data.quote_reference);
    const quote = quoteReference ? quotes.get(quoteReference) : undefined;
    const mode = text(quote?.mode);
    const eta = nullable(data.eta);
    const etaDistance = eta ? etaDays(eta, today) : null;
    const customs = customsByShipment.get(reference) ?? { total: 0, completed: 0, openTitles: [] };
    const openCustoms = Math.max(0, customs.total - customs.completed);
    const presentDocs = documentsByShipment.get(reference) ?? new Set<ShipmentDocumentType>();

    const requirementMap = new Map(defaultDocumentRequirements(mode).map((item) => [item.documentType, item.required]));
    const overrides = requirementOverrides.get(reference);
    if (overrides) for (const [type, required] of overrides) requirementMap.set(type, required);
    const missingRequired = [...requirementMap.entries()]
      .filter(([type, required]) => required && type !== "proof_of_delivery" && !presentDocs.has(type))
      .map(([type]) => type);

    if (isActive && !assignedName && !assignedEmail) {
      addCandidate({
        fingerprint: `shipment-unassigned:${reference}`,
        type: "shipment_unassigned",
        severity: "warning",
        title: `Shipment has no operational owner: ${reference}`,
        detail: `${branch ?? "Branch not assigned"} · assign a KCPL staff member so tasks and exceptions have a clear owner.`,
        reference,
        branch,
        assignedName,
        assignedEmail,
        escalated: false,
      });
      if (branch) addTask(reference, {
        id: "automation-owner",
        title: "Assign operational owner",
        detail: "KCPL Automation detected an active shipment without an operational owner. Assign an eligible staff member from People & branches.",
        branch,
        assignedUid: null,
        assignedName: null,
        assignedEmail: null,
        assignedPhone: null,
        dueHours: 8,
      });
    }

    if (isActive && etaDistance !== null && etaDistance >= 0 && etaDistance <= 1) {
      addCandidate({
        fingerprint: `eta-upcoming:${reference}:${eta?.slice(0, 10)}`,
        type: "eta_upcoming",
        severity: etaDistance === 0 ? "warning" : "info",
        title: `${etaDistance === 0 ? "ETA today" : "ETA tomorrow"}: ${reference}`,
        detail: `${eta?.slice(0, 10)} · ${openCustoms ? `${openCustoms} customs step${openCustoms === 1 ? "" : "s"} open · ` : ""}${missingRequired.length ? `${missingRequired.length} required document${missingRequired.length === 1 ? "" : "s"} missing` : "document pack ready"}.`,
        reference,
        branch,
        assignedName,
        assignedEmail,
        escalated: etaDistance === 0 && (openCustoms > 0 || missingRequired.length > 0),
      });
    }

    const customsUrgent = isActive && openCustoms > 0 && (status === "customs_clearance" || status === "out_for_delivery" || (etaDistance !== null && etaDistance <= 2));
    if (customsUrgent) {
      addCandidate({
        fingerprint: `customs-open:${reference}`,
        type: "customs_open",
        severity: status === "out_for_delivery" || etaDistance === 0 ? "critical" : "warning",
        title: `Customs work still open: ${reference}`,
        detail: `${customs.completed}/${customs.total} required customs steps complete${customs.openTitles.length ? ` · next: ${customs.openTitles.slice(0, 2).join(", ")}` : ""}.`,
        reference,
        branch,
        assignedName,
        assignedEmail,
        escalated: status === "out_for_delivery" || etaDistance === 0,
      });
      if (branch) addTask(reference, {
        id: "automation-customs",
        title: "Complete required customs clearance steps",
        detail: `${openCustoms} required customs step${openCustoms === 1 ? " remains" : "s remain"} open. Continue the customs checklist before final-mile progression.`,
        branch,
        assignedUid,
        assignedName,
        assignedEmail,
        assignedPhone,
        dueHours: etaDistance === 0 ? 4 : 12,
      });
    }

    const docsUrgent = isActive && missingRequired.length > 0 && (status !== "booking_confirmed" || (etaDistance !== null && etaDistance <= 2));
    if (docsUrgent) {
      const labels = missingRequired.map((type) => shipmentDocumentTypeLabels[type]);
      addCandidate({
        fingerprint: `required-documents-missing:${reference}`,
        type: "required_document_missing",
        severity: status === "out_for_delivery" || etaDistance === 0 ? "critical" : "warning",
        title: `Required document pack incomplete: ${reference}`,
        detail: `Missing ${labels.join(", ")}.`,
        reference,
        branch,
        assignedName,
        assignedEmail,
        escalated: status === "out_for_delivery" || etaDistance === 0,
      });
      if (branch) addTask(reference, {
        id: "automation-documents",
        title: "Complete required shipment document pack",
        detail: `Upload or verify the missing required documents: ${labels.join(", ")}.`,
        branch,
        assignedUid,
        assignedName,
        assignedEmail,
        assignedPhone,
        dueHours: etaDistance === 0 ? 4 : 12,
      });
    }

    if (status === "delivered" && !presentDocs.has("proof_of_delivery")) {
      addCandidate({
        fingerprint: `pod-missing:${reference}`,
        type: "pod_missing",
        severity: "critical",
        title: `Delivered shipment missing POD: ${reference}`,
        detail: "Upload Proof of Delivery before operational closeout.",
        reference,
        branch,
        assignedName,
        assignedEmail,
        escalated: true,
      });
      if (branch) addTask(reference, {
        id: "automation-pod",
        title: "Upload Proof of Delivery",
        detail: "The shipment is marked Delivered but no POD is present. Upload delivery evidence before closing the Job File.",
        branch,
        assignedUid,
        assignedName,
        assignedEmail,
        assignedPhone,
        dueHours: 4,
      });
    }

    if (isActive && status !== "exception") {
      const thresholdHours = stalledHours(status);
      const statusAt = nullable(data.status_changed_at) ?? nullable(data.updated_at) ?? nullable(data.created_at);
      const statusMs = statusAt ? Date.parse(statusAt) : Number.NaN;
      if (thresholdHours && Number.isFinite(statusMs) && now.getTime() - statusMs >= thresholdHours * 3_600_000) {
        addCandidate({
          fingerprint: `shipment-stalled:${reference}:${status}`,
          type: "shipment_stalled",
          severity: status === "customs_clearance" || status === "out_for_delivery" ? "critical" : "warning",
          title: `Shipment appears stalled in ${status.replaceAll("_", " ")}: ${reference}`,
          detail: `No shipment-level update has been recorded for at least ${thresholdHours >= 24 ? `${Math.round(thresholdHours / 24)} day${thresholdHours === 24 ? "" : "s"}` : `${thresholdHours} hours`}. Review location, ETA, tasks and blockers.`,
          reference,
          branch,
          assignedName,
          assignedEmail,
          escalated: status === "customs_clearance" || status === "out_for_delivery",
        });
      }
    }
  }

  const existingAlerts = new Map(existingAlertsSnapshot.docs.map((doc) => [doc.id, doc]));
  const existingExtra = existingAlertsSnapshot.docs.filter((doc) => EXTRA_TYPES.includes(doc.get("type") as AutomationAlertType));
  const operations: BatchOperation[] = [];
  let created = 0;
  let updated = 0;
  let resolved = 0;

  for (const candidate of candidates.values()) {
    const id = alertId(candidate.fingerprint);
    const ref = db.collection("alerts").doc(id);
    const existing = existingAlerts.get(id);
    const existingStatus = existing?.get("status");
    const firstTriggered = existing?.get("first_triggered_at") || nowIso;
    operations.push((batch) => batch.set(ref, {
      fingerprint: candidate.fingerprint,
      type: candidate.type,
      severity: candidate.severity,
      status: existingStatus === "acknowledged" ? "acknowledged" : "open",
      title: candidate.title,
      detail: candidate.detail,
      entity_type: "shipment",
      entity_id: candidate.reference,
      parent_reference: candidate.reference,
      branch: candidate.branch,
      assigned_to_name: candidate.assignedName,
      assigned_to_email: candidate.assignedEmail,
      target_roles: ["management", "operations"],
      action_path: `/admin/jobs/${encodeURIComponent(candidate.reference)}`,
      first_triggered_at: firstTriggered,
      last_triggered_at: nowIso,
      escalated_at: candidate.escalated ? (existing?.get("escalated_at") || nowIso) : null,
      acknowledged_at: existing?.get("acknowledged_at") || null,
      acknowledged_by_name: existing?.get("acknowledged_by_name") || null,
      acknowledged_by_email: existing?.get("acknowledged_by_email") || null,
      resolved_at: null,
      resolved_by_name: null,
      resolved_by_email: null,
      automation_source: "freight_ops",
    }, { merge: true }));
    if (existing) updated += 1; else created += 1;
  }

  for (const existing of existingExtra) {
    const fingerprint = text(existing.get("fingerprint"), existing.id);
    if (candidates.has(fingerprint) || existing.get("status") === "resolved") continue;
    operations.push((batch) => batch.set(existing.ref, {
      status: "resolved",
      resolved_at: nowIso,
      resolved_by_name: "KCPL Automation",
      resolved_by_email: "automation@kcpl.internal",
      last_triggered_at: existing.get("last_triggered_at") || nowIso,
    }, { merge: true }));
    resolved += 1;
  }

  const existingAutoTasks = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const task of autoTasksSnapshot.docs) {
    const reference = childShipmentId(task.ref);
    if (reference) existingAutoTasks.set(`${reference}:${task.id}`, task);
  }

  let tasksCreated = 0;
  let tasksReopened = 0;
  let tasksAutoCompleted = 0;
  const activeTaskIds = new Map<string, Set<string>>();

  for (const [reference, conditions] of tasksByShipment) {
    const set = new Set<string>();
    activeTaskIds.set(reference, set);
    for (const condition of conditions) {
      set.add(condition.id);
      const ref = db.collection("shipments").doc(reference).collection("job_tasks").doc(condition.id);
      const snapshot = existingAutoTasks.get(`${reference}:${condition.id}`);
      const assignment = {
        assigned_to_uid: condition.assignedUid,
        assigned_to_name: condition.assignedName,
        assigned_to_email: condition.assignedEmail,
        assigned_to_phone: condition.assignedPhone,
      };
      if (!snapshot) {
        operations.push((batch) => batch.set(ref, {
          title: condition.title,
          detail: condition.detail,
          branch: condition.branch,
          due_at: dueIso(now, condition.dueHours),
          ...assignment,
          completed: false,
          completed_at: null,
          created_at: nowIso,
          created_by: "automation@kcpl.internal",
          automation_generated: true,
          automation_key: condition.id,
        }));
        tasksCreated += 1;
      } else if (snapshot.get("completed") === true) {
        operations.push((batch) => batch.set(ref, {
          title: condition.title,
          detail: condition.detail,
          branch: condition.branch,
          due_at: dueIso(now, condition.dueHours),
          ...assignment,
          completed: false,
          completed_at: null,
          completed_by: null,
          automation_generated: true,
          automation_key: condition.id,
          automation_reopened_at: nowIso,
        }, { merge: true }));
        tasksReopened += 1;
      } else {
        operations.push((batch) => batch.set(ref, {
          title: condition.title,
          detail: condition.detail,
          branch: condition.branch,
          ...assignment,
          automation_generated: true,
          automation_key: condition.id,
        }, { merge: true }));
      }
    }
  }

  for (const task of autoTasksSnapshot.docs) {
    const reference = childShipmentId(task.ref);
    const active = activeTaskIds.get(reference) ?? new Set<string>();
    if (!reference || active.has(task.id) || task.get("completed") === true) continue;
    operations.push((batch) => batch.set(task.ref, {
      completed: true,
      completed_at: nowIso,
      completed_by: "automation@kcpl.internal",
      automation_resolved_at: nowIso,
    }, { merge: true }));
    tasksAutoCompleted += 1;
  }

  await commitOperations(operations);
  return {
    kind: "completed" as const,
    active: candidates.size,
    created,
    updated,
    resolved,
    tasks_created: tasksCreated,
    tasks_reopened: tasksReopened,
    tasks_auto_completed: tasksAutoCompleted,
  };
}
