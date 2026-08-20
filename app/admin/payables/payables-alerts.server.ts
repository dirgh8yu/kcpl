import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";

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

function fingerprintId(fingerprint: string) {
  return createHash("sha256").update(fingerprint).digest("hex").slice(0, 40);
}

export async function evaluatePayablesAlerts() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const [payablesSnapshot, alertsSnapshot] = await Promise.all([
    db.collection("payables").limit(4000).get(),
    db.collection("alerts").where("type", "==", "payable_overdue").limit(4000).get(),
  ]);
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const today = operationalDate(now);
  const active = new Set<string>();
  const batch = db.batch();
  let opened = 0;
  let resolved = 0;

  for (const doc of payablesSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const currentStatus = text(data.status);
    if (["draft", "paid", "void"].includes(currentStatus)) continue;
    const balanceDue = numberValue(data.balance_due);
    const dueDate = nullable(data.due_date);
    if (!dueDate || balanceDue <= 0 || dueDate >= today) continue;
    const dueMs = new Date(`${dueDate}T00:00:00Z`).getTime();
    const overdueDays = Number.isFinite(dueMs) ? Math.max(1, Math.floor((nowMs - dueMs) / 86_400_000)) : 1;
    const critical = overdueDays > 30;
    const fingerprint = `payable-overdue:${doc.id}`;
    active.add(fingerprint);
    const alertRef = db.collection("alerts").doc(fingerprintId(fingerprint));
    const existing = alertsSnapshot.docs.find((item) => text(item.get("fingerprint"), item.id) === fingerprint);
    batch.set(alertRef, {
      fingerprint,
      type: "payable_overdue",
      severity: critical ? "critical" : "warning",
      status: existing && text(existing.get("status")) !== "resolved" ? text(existing.get("status"), "open") : "open",
      title: `${critical ? "Payable overdue 30d+" : "Supplier bill overdue"}: ${doc.id}`,
      detail: `${text(data.currency, "NPR")} ${balanceDue.toLocaleString("en-AU")} payable · due ${dueDate} · ${text(data.supplier_name, "Supplier")}`,
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
      escalated_at: critical ? nowIso : nullable(existing?.get("escalated_at")),
      acknowledged_at: nullable(existing?.get("acknowledged_at")),
      acknowledged_by_name: nullable(existing?.get("acknowledged_by_name")),
      acknowledged_by_email: nullable(existing?.get("acknowledged_by_email")),
      resolved_at: null,
      resolved_by_name: null,
      resolved_by_email: null,
      source: "automation",
    }, { merge: true });
    opened += 1;
  }

  for (const alert of alertsSnapshot.docs) {
    const fingerprint = text(alert.get("fingerprint"), alert.id);
    if (active.has(fingerprint) || text(alert.get("status")) === "resolved") continue;
    batch.update(alert.ref, {
      status: "resolved",
      resolved_at: nowIso,
      resolved_by_name: "KCPL Automation",
      resolved_by_email: null,
      last_triggered_at: nowIso,
    });
    resolved += 1;
  }

  await batch.commit();
  return { kind: "completed" as const, active: active.size, opened, resolved };
}
