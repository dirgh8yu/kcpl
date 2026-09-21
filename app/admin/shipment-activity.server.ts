import { mockShipmentActivityTimeline, qaMockDataEnabled } from "./qa-fixtures.ts";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../shipment-document-types";
import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "./staff-directory.server";
import type { ShipmentActivityCategory, ShipmentActivityItem, ShipmentActivityTimeline, ShipmentActivityTone } from "./shipment-activity";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function branchArray(value: unknown) {
  if (!Array.isArray(value)) return [] as KcplBranch[];
  return value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch));
}

function item(values: ShipmentActivityItem): ShipmentActivityItem {
  return values;
}

function activityCategory(type: string): ShipmentActivityCategory {
  if (type.includes("finance") || type.includes("invoice") || type.includes("payment")) return "finance";
  if (type.includes("owner") || type.includes("assign")) return "ownership";
  if (type.includes("customs")) return "customs";
  if (type.includes("document") || type.includes("pod")) return "document";
  if (type.includes("alert")) return "alert";
  if (type.includes("workflow") || type.includes("close") || type.includes("reopen")) return "workflow";
  if (type.includes("task")) return "task";
  return "workflow";
}

function activityTone(type: string, title: string): ShipmentActivityTone {
  const value = `${type} ${title}`.toLowerCase();
  if (value.includes("override") || value.includes("exception") || value.includes("deleted")) return "danger";
  if (value.includes("overdue") || value.includes("warning") || value.includes("blocked")) return "warning";
  if (value.includes("complete") || value.includes("closed") || value.includes("paid") || value.includes("resolved") || value.includes("uploaded")) return "success";
  if (value.includes("customs")) return "violet";
  return "info";
}

function documentLabel(value: unknown) {
  const type = text(value) as ShipmentDocumentType;
  return shipmentDocumentTypeLabels[type] ?? text(value, "Shipment document").replaceAll("_", " ");
}

export async function getShipmentActivityTimeline(reference: string, context: KcplStaffContext) {
  if (qaMockDataEnabled()) return mockShipmentActivityTimeline(reference, context);
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = reference.trim().toUpperCase();
  const shipmentRef = db.collection("shipments").doc(id);
  const shipment = await shipmentRef.get();
  if (!shipment.exists) return { kind: "missing" as const };

  const shipmentData = shipment.data() as Record<string, unknown>;
  const primaryBranch = branchValue(shipmentData.primary_branch);
  const handlingBranches = branchArray(shipmentData.handling_branches);
  const accessBranches = [...new Set([...(primaryBranch ? [primaryBranch] : []), ...handlingBranches])];
  if (accessBranches.length && !accessBranches.some((branch) => staffCanAccessBranch(context, branch))) {
    return { kind: "forbidden" as const };
  }

  const [eventsSnapshot, activitySnapshot, tasksSnapshot, customsSnapshot, documentsSnapshot, alertsSnapshot] = await Promise.all([
    shipmentRef.collection("events").orderBy("event_time", "desc").limit(500).get(),
    shipmentRef.collection("job_activity").orderBy("created_at", "desc").limit(1000).get(),
    shipmentRef.collection("job_tasks").limit(1000).get(),
    shipmentRef.collection("customs_steps").limit(600).get(),
    shipmentRef.collection("documents").orderBy("uploaded_at", "desc").limit(1000).get(),
    db.collection("alerts").where("parent_reference", "==", id).limit(1000).get(),
  ]);

  const items: ShipmentActivityItem[] = [];
  const fallbackBranch = primaryBranch ?? handlingBranches[0] ?? null;

  for (const doc of eventsSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const title = text(data.title, "Shipment update");
    items.push(item({
      id: `shipment:${doc.id}`,
      category: "shipment",
      title,
      detail: nullable(data.details) ?? (nullable(data.location) ? `Location: ${nullable(data.location)}` : null),
      occurred_at: text(data.event_time, text(data.created_at)),
      actor_name: nullable(data.author_name),
      actor_email: null,
      branch: fallbackBranch,
      source: "Shipment milestone",
      tone: title.toLowerCase().includes("exception") ? "danger" : title.toLowerCase().includes("delivered") ? "success" : "info",
    }));
  }

  for (const doc of activitySnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const type = text(data.type, "job_activity");
    const category = activityCategory(type);
    if (category === "finance" && !context.permissions.canManageFinance && !context.permissions.canManageJobCosts) continue;
    const title = text(data.title, "Job File activity");
    items.push(item({
      id: `activity:${doc.id}`,
      category,
      title,
      detail: nullable(data.detail),
      occurred_at: text(data.created_at),
      actor_name: nullable(data.actor_name),
      actor_email: nullable(data.actor_email),
      branch: branchValue(data.branch) ?? fallbackBranch,
      source: "Job File audit",
      tone: activityTone(type, title),
    }));
  }

  for (const doc of tasksSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const title = text(data.title, "Operational task");
    const branch = branchValue(data.branch) ?? fallbackBranch;
    const assignee = nullable(data.assigned_to_name) ?? nullable(data.assigned_to_email);
    items.push(item({
      id: `task-created:${doc.id}`,
      category: "task",
      title: `Task created: ${title}`,
      detail: [nullable(data.detail), assignee ? `Assigned to ${assignee}` : "Unassigned"].filter(Boolean).join(" · ") || null,
      occurred_at: text(data.created_at),
      actor_name: null,
      actor_email: nullable(data.created_by),
      branch,
      source: data.automation_generated === true ? "Automation task" : "Operational task",
      tone: data.automation_generated === true ? "warning" : "neutral",
    }));
    const completedAt = nullable(data.completed_at);
    if (completedAt) {
      items.push(item({
        id: `task-completed:${doc.id}`,
        category: "task",
        title: `Task completed: ${title}`,
        detail: assignee ? `Assigned to ${assignee}` : null,
        occurred_at: completedAt,
        actor_name: null,
        actor_email: nullable(data.completed_by),
        branch,
        source: data.automation_generated === true ? "Automation task" : "Operational task",
        tone: "success",
      }));
    }
  }

  for (const doc of customsSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const title = text(data.title, "Customs step");
    const branch = branchValue(data.branch) ?? fallbackBranch;
    items.push(item({
      id: `customs-created:${doc.id}`,
      category: "customs",
      title: `Customs step added: ${title}`,
      detail: nullable(data.detail),
      occurred_at: text(data.created_at),
      actor_name: null,
      actor_email: nullable(data.created_by),
      branch,
      source: "Customs checklist",
      tone: "violet",
    }));
    const completedAt = nullable(data.completed_at);
    if (completedAt) {
      items.push(item({
        id: `customs-completed:${doc.id}`,
        category: "customs",
        title: `Customs completed: ${title}`,
        detail: data.required === false ? "Optional clearance step completed." : "Required clearance step completed.",
        occurred_at: completedAt,
        actor_name: null,
        actor_email: nullable(data.completed_by),
        branch,
        source: "Customs checklist",
        tone: "success",
      }));
    }
  }

  for (const doc of documentsSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const label = documentLabel(data.document_type);
    items.push(item({
      id: `document:${doc.id}`,
      category: "document",
      title: `${label} uploaded`,
      detail: nullable(data.filename),
      occurred_at: text(data.uploaded_at),
      actor_name: nullable(data.uploaded_by),
      actor_email: nullable(data.uploaded_by_email),
      branch: fallbackBranch,
      source: "Document vault",
      tone: "success",
    }));
  }

  for (const doc of alertsSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const title = text(data.title, "Operational alert");
    const branch = branchValue(data.branch) ?? fallbackBranch;
    const severity = text(data.severity);
    items.push(item({
      id: `alert-triggered:${doc.id}`,
      category: "alert",
      title: `Alert triggered: ${title}`,
      detail: nullable(data.detail),
      occurred_at: text(data.first_triggered_at, text(data.last_triggered_at)),
      actor_name: null,
      actor_email: nullable(data.assigned_to_email),
      branch,
      source: "Automation alert",
      tone: severity === "critical" ? "danger" : severity === "warning" ? "warning" : "info",
    }));
    const acknowledgedAt = nullable(data.acknowledged_at);
    if (acknowledgedAt) {
      items.push(item({
        id: `alert-acknowledged:${doc.id}`,
        category: "alert",
        title: `Alert acknowledged: ${title}`,
        detail: null,
        occurred_at: acknowledgedAt,
        actor_name: nullable(data.acknowledged_by_name),
        actor_email: nullable(data.acknowledged_by_email),
        branch,
        source: "Automation alert",
        tone: "info",
      }));
    }
    const resolvedAt = nullable(data.resolved_at);
    if (resolvedAt) {
      items.push(item({
        id: `alert-resolved:${doc.id}`,
        category: "alert",
        title: `Alert resolved: ${title}`,
        detail: null,
        occurred_at: resolvedAt,
        actor_name: nullable(data.resolved_by_name),
        actor_email: nullable(data.resolved_by_email),
        branch,
        source: "Automation alert",
        tone: "success",
      }));
    }
  }

  const timeline: ShipmentActivityTimeline = {
    reference: id,
    generated_at: new Date().toISOString(),
    items: items
      .filter((entry) => entry.occurred_at)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 2500),
  };
  return { kind: "ready" as const, timeline };
}

/** Newest raw job_activity timestamp for a shipment — feeds the server-side
 * last-visit divider so "new since" anchors follow the staff member across
 * devices. Firestore-only: QA mock timelines have no cross-device meaning. */
/** Tone derivation shared with the live activity-alert feed, which reads raw
 * job_activity docs (type/title) that do not carry a stored tone. */
export function activityToneFor(type: string, title: string): ShipmentActivityTone {
  return activityTone(type, title);
}

export async function getShipmentLatestActivity(reference: string): Promise<string | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb()
    .collection("shipments").doc(reference.trim().toUpperCase())
    .collection("job_activity")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
  return text(snapshot.docs[0]?.get("created_at")) || null;
}

/** Per-staff, per-shipment last-visit anchor, persisted server-side so the
 * "since your last visit" divider follows the user across devices. Falls back
 * to null (no divider) when Firestore is unavailable — the timeline then
 * behaves like a first visit rather than blocking the page. */
export async function readShipmentLastVisit(uid: string, reference: string): Promise<{ seenThroughAt: string | null; kind: "stored" | "unavailable" }> {
  if (!firebaseRuntimeConfigured()) return { seenThroughAt: null, kind: "unavailable" };
  const doc = await firebaseAdminDb()
    .collection("staff_activity_visits").doc(uid)
    .collection("shipments").doc(reference.trim().toUpperCase())
    .get();
  const value = text(doc.get("seen_through_at"));
  return { seenThroughAt: value || null, kind: doc.exists ? "stored" : "unavailable" };
}

export async function recordShipmentVisit(uid: string, reference: string, seenThroughAt: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  await firebaseAdminDb()
    .collection("staff_activity_visits").doc(uid)
    .collection("shipments").doc(reference.trim().toUpperCase())
    .set({ seen_through_at: seenThroughAt, visited_at: seenThroughAt }, { merge: true });
  return { kind: "stored" as const };
}

/** Seen-receipt for the live activity alert feed, so a danger-tone poll only
 * rings the bell once per staff member per activity entry. */
export async function recordActivityAlertReceipt(uid: string, reference: string, activityId: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  await firebaseAdminDb()
    .collection("staff_activity_alert_receipts").doc(uid)
    .collection("items").doc(`${reference.trim().toUpperCase()}__${activityId}`)
    .set({ activity_id: activityId, reference: reference.trim().toUpperCase(), seen_at: new Date().toISOString() }, { merge: true });
  return { kind: "stored" as const };
}
