import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";

const MAX_BATCH_WRITES = 400;

type BatchOperation = (batch: FirebaseFirestore.WriteBatch) => void;

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

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
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

function overdueDays(dueDate: string, today: string) {
  const dueMs = dateOnlyMs(dueDate);
  const todayMs = dateOnlyMs(today);
  return Number.isFinite(dueMs) && Number.isFinite(todayMs)
    ? Math.max(1, Math.floor((todayMs - dueMs) / 86_400_000))
    : 1;
}

function fingerprintId(fingerprint: string) {
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 40);
}

async function commitOperations(operations: BatchOperation[]) {
  const db = firebaseAdminDb();
  for (let index = 0; index < operations.length; index += MAX_BATCH_WRITES) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + MAX_BATCH_WRITES)) operation(batch);
    await batch.commit();
  }
}

export async function evaluatePayablesAlerts() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const [payablesSnapshot, alertsSnapshot] = await Promise.all([
    db.collection("payables").limit(4000).get(),
    db.collection("alerts").where("type", "==", "payable_overdue").limit(4000).get(),
  ]);
  const nowIso = new Date().toISOString();
  const today = operationalDate();
  const active = new Set<string>();
  const existingByFingerprint = new Map(alertsSnapshot.docs.map((doc) => [text(doc.get("fingerprint"), doc.id), doc]));
  const operations: BatchOperation[] = [];
  let opened = 0;
  let resolved = 0;

  for (const doc of payablesSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const currentStatus = text(data.status);
    if (["draft", "paid", "void"].includes(currentStatus)) continue;
    const balanceDue = numberValue(data.balance_due);
    const dueDate = nullable(data.due_date);
    if (!dueDate || balanceDue <= 0 || dueDate >= today) continue;

    const daysOverdue = overdueDays(dueDate, today);
    const critical = daysOverdue > 30;
    const fingerprint = `payable-overdue:${doc.id}`;
    active.add(fingerprint);
    const alertRef = db.collection("alerts").doc(fingerprintId(fingerprint));
    const existing = existingByFingerprint.get(fingerprint);
    const previousStatus = text(existing?.get("status"), "open");
    const previousSeverity = text(existing?.get("severity"));
    const escalated = critical && (previousSeverity !== "critical" || previousStatus === "resolved");
    const acknowledgedAt = escalated || previousStatus === "resolved" ? null : nullable(existing?.get("acknowledged_at"));
    const restoredStatus = escalated || previousStatus === "resolved"
      ? "open"
      : acknowledgedAt
        ? "acknowledged"
        : previousStatus === "acknowledged"
          ? "acknowledged"
          : "open";
    const previousEscalatedAt = nullable(existing?.get("escalated_at"));

    operations.push((batch) => batch.set(alertRef, {
      fingerprint,
      type: "payable_overdue",
      severity: critical ? "critical" : "warning",
      status: restoredStatus,
      title: `${critical ? "Payable overdue 30d+" : "Supplier bill overdue"}: ${doc.id}`,
      detail: `${text(data.currency, "NPR")} ${balanceDue.toLocaleString("en-AU")} payable · due ${dueDate} · ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue · ${text(data.supplier_name, "Supplier")}`,
      entity_type: "payable",
      entity_id: doc.id,
      parent_reference: nullable(data.shipment_reference),
      branch: branchValue(data.branch),
      assigned_to_name: null,
      assigned_to_email: null,
      target_roles: ["management", "accounts"],
      action_path: `/admin/payables/bills/${encodeURIComponent(doc.id)}`,
      first_triggered_at: existing ? text(existing.get("first_triggered_at"), nowIso) : nowIso,
      last_triggered_at: nowIso,
      escalated_at: escalated ? nowIso : previousEscalatedAt,
      acknowledged_at: acknowledgedAt,
      acknowledged_by_name: acknowledgedAt ? nullable(existing?.get("acknowledged_by_name")) : null,
      acknowledged_by_email: acknowledgedAt ? nullable(existing?.get("acknowledged_by_email")) : null,
      resolved_at: null,
      resolved_by_name: null,
      resolved_by_email: null,
      source: "automation",
    }, { merge: true }));
    opened += 1;
  }

  for (const alert of alertsSnapshot.docs) {
    const fingerprint = text(alert.get("fingerprint"), alert.id);
    if (active.has(fingerprint) || text(alert.get("status")) === "resolved") continue;
    operations.push((batch) => batch.update(alert.ref, {
      status: "resolved",
      resolved_at: nowIso,
      resolved_by_name: "KCPL Automation",
      resolved_by_email: null,
      last_triggered_at: nowIso,
    }));
    resolved += 1;
  }

  await commitOperations(operations);
  return { kind: "completed" as const, active: active.size, opened, resolved };
}
