import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { jobPriorities, type JobPriority } from "../job-file";
import { staffCanAccessBranch, listStaffProfiles, type KcplStaffContext } from "../staff-directory.server";
import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import type { CommandCentreBranchLoad, CommandCentreData, CommandCentreJob, CommandCentreStaffLoad } from "./command-centre-data";

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

function branchArray(value: unknown): KcplBranch[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))];
}

function priorityValue(value: unknown): JobPriority {
  return jobPriorities.includes(value as JobPriority) ? value as JobPriority : "standard";
}

function statusValue(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function shipmentIdFromChild(path: FirebaseFirestore.DocumentReference) {
  return path.parent.parent?.id ?? "";
}

function timestamp(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function hasCustomsRisk(job: CommandCentreJob, today: string) {
  if (job.required_customs_open <= 0) return false;
  const etaDate = job.eta?.slice(0, 10) ?? "";
  return job.status === "customs_clearance" || Boolean(etaDate && etaDate <= today);
}

async function loadDocumentsByIds(collectionName: string, ids: Iterable<string>) {
  const db = firebaseAdminDb();
  const uniqueIds = [...new Set([...ids].map((id) => id.trim()).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();

  // Firestore batchGet is substantially cheaper and safer than reading an
  // arbitrary slice of an entire collection as the company grows.
  for (let index = 0; index < uniqueIds.length; index += 250) {
    const batch = uniqueIds.slice(index, index + 250);
    const snapshots = await db.getAll(...batch.map((id) => db.collection(collectionName).doc(id)));
    for (const snapshot of snapshots) {
      if (snapshot.exists) result.set(snapshot.id, snapshot.data() as Record<string, unknown>);
    }
  }
  return result;
}

export async function loadCommandCentre(context: KcplStaffContext): Promise<CommandCentreData | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, tasksSnapshot, customsSnapshot, staffProfiles] = await Promise.all([
    db.collection("shipments").limit(2000).get(),
    db.collectionGroup("job_tasks").limit(8000).get(),
    db.collectionGroup("customs_steps").limit(5000).get(),
    listStaffProfiles(),
  ]);

  const today = operationalDate();
  const now = Date.now();

  const accessibleShipmentRows = shipmentsSnapshot.docs.flatMap((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const status = statusValue(data.status);
    if (status === "delivered") return [];
    const primaryValue = branchValue(data.primary_branch);
    const handlingValue = branchArray(data.handling_branches);
    const accessBranches = [...new Set([...(primaryValue ? [primaryValue] : []), ...handlingValue])];
    const allowed = context.can_access_all_branches || accessBranches.some((branch) => staffCanAccessBranch(context, branch));
    if (!allowed) return [];
    // All-branch users can still repair legacy records with missing branch data.
    // Restricted users fail closed above instead of having malformed records
    // silently treated as Kathmandu work.
    const primary = primaryValue ?? handlingValue[0] ?? "Kathmandu";
    const handling = [...handlingValue];
    if (!handling.includes(primary)) handling.unshift(primary);
    return [{ id: doc.id, data, status, primary, handling }];
  });
  const accessibleShipmentIds = new Set(accessibleShipmentRows.map((row) => row.id));

  const taskStats = new Map<string, { open: number; overdue: number }>();
  const staffTaskStats = new Map<string, { name: string; email: string; open: number; overdue: number }>();
  for (const doc of tasksSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.completed === true) continue;
    const shipmentId = shipmentIdFromChild(doc.ref);
    if (!shipmentId || !accessibleShipmentIds.has(shipmentId)) continue;

    const dueAt = nullable(data.due_at);
    const dueTime = dueAt ? Date.parse(dueAt) : Number.NaN;
    const overdue = Number.isFinite(dueTime) && dueTime < now;
    const stats = taskStats.get(shipmentId) ?? { open: 0, overdue: 0 };
    stats.open += 1;
    if (overdue) stats.overdue += 1;
    taskStats.set(shipmentId, stats);

    const email = text(data.assigned_to_email).trim().toLowerCase();
    const name = text(data.assigned_to_name, email || "Unassigned").trim() || "Unassigned";
    if (email || name !== "Unassigned") {
      const key = email || name.toLowerCase();
      const staff = staffTaskStats.get(key) ?? { name, email, open: 0, overdue: 0 };
      staff.open += 1;
      if (overdue) staff.overdue += 1;
      staffTaskStats.set(key, staff);
    }
  }

  const customsStats = new Map<string, { open: number; total: number }>();
  for (const doc of customsSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.required === false) continue;
    const shipmentId = shipmentIdFromChild(doc.ref);
    if (!shipmentId || !accessibleShipmentIds.has(shipmentId)) continue;
    const stats = customsStats.get(shipmentId) ?? { open: 0, total: 0 };
    stats.total += 1;
    if (data.completed !== true) stats.open += 1;
    customsStats.set(shipmentId, stats);
  }

  const quoteReferences = accessibleShipmentRows.map((row) => text(row.data.quote_reference));
  const customerIds = accessibleShipmentRows.flatMap((row) => {
    const id = nullable(row.data.customer_id);
    return id ? [id] : [];
  });
  const [quotes, customers] = await Promise.all([
    loadDocumentsByIds("quotes", quoteReferences),
    loadDocumentsByIds("customers", customerIds),
  ]);

  const jobs: CommandCentreJob[] = accessibleShipmentRows.map(({ id, data, status, primary, handling }) => {
    const quoteReference = text(data.quote_reference);
    const quote = quotes.get(quoteReference) ?? {};
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) : undefined;
    const task = taskStats.get(id) ?? { open: 0, overdue: 0 };
    const customs = customsStats.get(id) ?? { open: 0, total: 0 };
    return {
      reference: id,
      quote_reference: quoteReference,
      customer_id: customerId,
      customer_name: customer ? text(customer.display_name, "Linked customer") : text(quote.company_name, text(quote.contact_name, "Unlinked customer")),
      origin: text(quote.origin),
      destination: text(quote.destination),
      mode: text(quote.mode),
      status,
      primary_branch: primary,
      handling_branches: handling,
      assigned_to_name: nullable(data.job_assigned_to_name),
      assigned_to_email: nullable(data.job_assigned_to_email),
      priority: priorityValue(data.job_priority),
      eta: nullable(data.eta),
      current_location: nullable(data.current_location),
      carrier: nullable(data.carrier),
      open_tasks: task.open,
      overdue_tasks: task.overdue,
      required_customs_open: customs.open,
      required_customs_total: customs.total,
      updated_at: text(data.updated_at),
    };
  });

  jobs.sort((a, b) => {
    const score = (job: CommandCentreJob) =>
      (job.status === "exception" ? 100 : 0) +
      (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
      job.overdue_tasks * 10 +
      (hasCustomsRisk(job, today) ? job.required_customs_open * 4 : 0) +
      (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
    return score(b) - score(a) || timestamp(b.updated_at) - timestamp(a.updated_at);
  });

  const accessibleBranches = context.can_access_all_branches ? [...kcplBranches] : context.branches;
  const branchLoad: CommandCentreBranchLoad[] = accessibleBranches.map((branch) => {
    const branchJobs = jobs.filter((job) => job.primary_branch === branch || job.handling_branches.includes(branch));
    return {
      branch,
      active_jobs: branchJobs.length,
      urgent_jobs: branchJobs.filter((job) => job.priority === "urgent" || job.status === "exception").length,
      overdue_tasks: branchJobs.reduce((sum, job) => sum + job.overdue_tasks, 0),
      customs_blockers: branchJobs.filter((job) => hasCustomsRisk(job, today)).reduce((sum, job) => sum + job.required_customs_open, 0),
      deliveries_today: branchJobs.filter((job) => job.eta?.slice(0, 10) === today).length,
    };
  }).sort((a, b) => b.active_jobs - a.active_jobs || b.overdue_tasks - a.overdue_tasks || a.branch.localeCompare(b.branch));

  const staffMap = new Map<string, CommandCentreStaffLoad>();
  for (const profile of staffProfiles ?? []) {
    if (!profile.active) continue;
    if (!context.can_access_all_branches && profile.branch_scope === "selected" && !profile.branches.some((branch) => context.branches.includes(branch))) continue;
    const key = profile.email || profile.uid;
    const task = staffTaskStats.get(profile.email.toLowerCase());
    staffMap.set(key, {
      key,
      name: profile.display_name,
      email: profile.email,
      active_jobs: 0,
      urgent_jobs: 0,
      open_tasks: task?.open ?? 0,
      overdue_tasks: task?.overdue ?? 0,
    });
  }
  for (const job of jobs) {
    const email = job.assigned_to_email?.toLowerCase() ?? "";
    const name = job.assigned_to_name ?? "Unassigned";
    if (!email && name === "Unassigned") continue;
    const key = email || name.toLowerCase();
    const existing = staffMap.get(key) ?? {
      key,
      name,
      email,
      active_jobs: 0,
      urgent_jobs: 0,
      open_tasks: staffTaskStats.get(key)?.open ?? 0,
      overdue_tasks: staffTaskStats.get(key)?.overdue ?? 0,
    };
    existing.active_jobs += 1;
    if (job.priority === "urgent" || job.status === "exception") existing.urgent_jobs += 1;
    staffMap.set(key, existing);
  }
  const staffLoad = [...staffMap.values()].sort((a, b) => b.overdue_tasks - a.overdue_tasks || b.urgent_jobs - a.urgent_jobs || b.active_jobs - a.active_jobs || a.name.localeCompare(b.name));

  return {
    generated_at: new Date().toISOString(),
    operational_date: today,
    accessible_branches: accessibleBranches,
    totals: {
      active_jobs: jobs.length,
      urgent_jobs: jobs.filter((job) => job.priority === "urgent").length,
      overdue_tasks: jobs.reduce((sum, job) => sum + job.overdue_tasks, 0),
      customs_blockers: jobs.filter((job) => hasCustomsRisk(job, today)).reduce((sum, job) => sum + job.required_customs_open, 0),
      deliveries_today: jobs.filter((job) => job.eta?.slice(0, 10) === today).length,
      unassigned_jobs: jobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length,
      exception_jobs: jobs.filter((job) => job.status === "exception").length,
    },
    jobs,
    branch_load: branchLoad,
    staff_load: staffLoad,
  };
}
