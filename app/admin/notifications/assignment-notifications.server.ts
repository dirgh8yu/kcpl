import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import type { KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import type { OperationsNotification } from "./notification-data";
import { getNotificationPreferences } from "./notification-centre.server";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function receiptMap(snapshot: FirebaseFirestore.QuerySnapshot) {
  return new Map(snapshot.docs.map((doc) => [text(doc.get("notification_id")), text(doc.get("read_at"))]));
}

function shipmentIdFromChild(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

export async function listCurrentStaffAssignmentNotifications(context: KcplStaffContext, email: string) {
  if (!firebaseRuntimeConfigured()) return [] as OperationsNotification[];
  const db = firebaseAdminDb();
  const normalizedEmail = email.trim().toLowerCase();
  const [shipments, jobTasks, customerTasks, receiptsSnapshot, preferences] = await Promise.all([
    db.collection("shipments").where("job_assigned_to_email", "==", normalizedEmail).limit(500).get(),
    db.collectionGroup("job_tasks").where("assigned_to_email", "==", normalizedEmail).limit(1000).get(),
    db.collectionGroup("tasks").where("assigned_to_email", "==", normalizedEmail).limit(1000).get(),
    db.collection("staff_notification_receipts").doc(context.profile.uid).collection("items").limit(1000).get(),
    getNotificationPreferences(context.profile.uid),
  ]);
  const receipts = receiptMap(receiptsSnapshot);
  const output: OperationsNotification[] = [];

  if (preferences.categories.assignments) {
    for (const doc of shipments.docs) {
      const branch = nullable(doc.get("primary_branch")) as KcplBranch | null;
      if (branch && !staffCanAccessBranch(context, branch)) continue;
      const id = `assignment:shipment:${doc.id}`;
      const status = text(doc.get("status"));
      const resolved = status === "delivered";
      output.push({
        id,
        source: "direct",
        source_id: doc.id,
        category: "assignments",
        severity: status === "exception" ? "critical" : "info",
        title: `Shipment assigned to you: ${doc.id}`,
        detail: `${text(doc.get("current_location"), "Operational movement")} · ${branch || "Branch not recorded"}${status ? ` · ${status.replaceAll("_", " ")}` : ""}`,
        action_path: `/admin/jobs/${encodeURIComponent(doc.id)}`,
        branch,
        created_at: text(doc.get("created_at"), text(doc.get("updated_at"))),
        resolved,
        read_at: receipts.get(id) || null,
      });
    }
  }

  if (preferences.categories.tasks) {
    for (const doc of jobTasks.docs) {
      const shipmentReference = shipmentIdFromChild(doc.ref);
      if (!shipmentReference) continue;
      const branch = nullable(doc.get("branch")) as KcplBranch | null;
      if (branch && !staffCanAccessBranch(context, branch)) continue;
      const id = `assignment:job-task:${shipmentReference}:${doc.id}`;
      const completed = doc.get("completed") === true;
      const dueAt = nullable(doc.get("due_at"));
      const overdue = !completed && dueAt ? Date.parse(dueAt) < Date.now() : false;
      output.push({
        id,
        source: "direct",
        source_id: doc.id,
        category: "tasks",
        severity: overdue ? "warning" : "info",
        title: text(doc.get("title"), "Shipment task assigned to you"),
        detail: `${shipmentReference}${dueAt ? ` · due ${dueAt}` : " · no due time"}`,
        action_path: `/admin/jobs/${encodeURIComponent(shipmentReference)}`,
        branch,
        created_at: text(doc.get("created_at")),
        resolved: completed,
        read_at: receipts.get(id) || null,
      });
    }

    for (const doc of customerTasks.docs) {
      const customerId = doc.ref.parent.parent?.id ?? "";
      if (!customerId) continue;
      const customer = await db.collection("customers").doc(customerId).get();
      if (!customer.exists) continue;
      const branch = nullable(customer.get("primary_branch")) as KcplBranch | null;
      if (branch && !staffCanAccessBranch(context, branch)) continue;
      const id = `assignment:crm-task:${customerId}:${doc.id}`;
      const completed = doc.get("completed") === true;
      const dueAt = nullable(doc.get("due_at"));
      const overdue = !completed && dueAt ? Date.parse(dueAt) < Date.now() : false;
      output.push({
        id,
        source: "direct",
        source_id: doc.id,
        category: "tasks",
        severity: overdue ? "warning" : "info",
        title: text(doc.get("title"), "Customer follow-up assigned to you"),
        detail: `${text(customer.get("display_name"), customerId)}${dueAt ? ` · due ${dueAt}` : " · no due time"}`,
        action_path: `/admin/crm/${encodeURIComponent(customerId)}`,
        branch,
        created_at: text(doc.get("created_at")),
        resolved: completed,
        read_at: receipts.get(id) || null,
      });
    }
  }

  return output.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
