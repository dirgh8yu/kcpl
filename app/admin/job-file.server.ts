import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { kcplBranches, crmCurrencies, type KcplBranch, type CrmCurrency } from "./crm/crm-data";
import { shipmentStatuses, type ShipmentStatus } from "../shipment-types";
import { staffCanAccessBranch, type KcplStaffContext } from "./staff-directory.server";
import {
  jobCostCategories,
  jobPriorities,
  type CustomsStep,
  type DigitalJobFile,
  type JobCost,
  type JobCostCategory,
  type JobPriority,
  type JobTask,
} from "./job-file";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function booleanValue(value: unknown) {
  return value === true;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function branchValue(value: unknown, fallback: KcplBranch = "Kathmandu"): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : fallback;
}

function branchArray(value: unknown): KcplBranch[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch));
}

function statusValue(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function priorityValue(value: unknown): JobPriority {
  return jobPriorities.includes(value as JobPriority) ? value as JobPriority : "standard";
}

function currencyValue(value: unknown): CrmCurrency {
  return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : "NPR";
}

function costCategory(value: unknown): JobCostCategory {
  return jobCostCategories.includes(value as JobCostCategory) ? value as JobCostCategory : "other";
}

function childId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function taskFromDoc(id: string, data: Record<string, unknown>): JobTask {
  return {
    id,
    title: text(data.title),
    detail: nullable(data.detail),
    branch: branchValue(data.branch),
    due_at: nullable(data.due_at),
    assigned_to_name: nullable(data.assigned_to_name),
    assigned_to_email: nullable(data.assigned_to_email),
    assigned_to_phone: nullable(data.assigned_to_phone),
    completed: booleanValue(data.completed),
    completed_at: nullable(data.completed_at),
    created_at: text(data.created_at),
    created_by: text(data.created_by, "KCPL Staff"),
  };
}

function customsFromDoc(id: string, data: Record<string, unknown>): CustomsStep {
  return {
    id,
    title: text(data.title),
    detail: nullable(data.detail),
    branch: branchValue(data.branch),
    required: data.required !== false,
    completed: booleanValue(data.completed),
    completed_at: nullable(data.completed_at),
    completed_by: nullable(data.completed_by),
    created_at: text(data.created_at),
  };
}

function costFromDoc(id: string, data: Record<string, unknown>): JobCost {
  return {
    id,
    category: costCategory(data.category),
    label: text(data.label),
    vendor: nullable(data.vendor),
    amount: numberValue(data.amount),
    currency: currencyValue(data.currency),
    notes: nullable(data.notes),
    source_type: data.source_type === "payable" ? "payable" : "manual",
    source_reference: nullable(data.source_reference),
    locked: data.locked === true,
    created_at: text(data.created_at),
    created_by: text(data.created_by, "KCPL Staff"),
  };
}

async function resolveBranches(shipmentData: Record<string, unknown>) {
  let primary = kcplBranches.includes(shipmentData.primary_branch as KcplBranch)
    ? shipmentData.primary_branch as KcplBranch
    : null;
  if (!primary && typeof shipmentData.customer_id === "string" && shipmentData.customer_id) {
    const customer = await firebaseAdminDb().collection("customers").doc(shipmentData.customer_id).get();
    if (customer.exists) primary = branchValue(customer.get("primary_branch"));
  }
  primary ||= "Kathmandu";
  const handling = branchArray(shipmentData.handling_branches);
  if (!handling.includes(primary)) handling.unshift(primary);
  return { primary, handling };
}

function canAccessJob(context: KcplStaffContext, primary: KcplBranch, handling: KcplBranch[]) {
  return staffCanAccessBranch(context, primary) || handling.some((branch) => staffCanAccessBranch(context, branch));
}

export async function getDigitalJobFile(reference: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = reference.trim().toUpperCase();
  const shipmentRef = db.collection("shipments").doc(id);
  const shipment = await shipmentRef.get();
  if (!shipment.exists) return { kind: "missing" as const };
  const shipmentData = shipment.data() as Record<string, unknown>;
  const { primary, handling } = await resolveBranches(shipmentData);
  if (!canAccessJob(context, primary, handling)) return { kind: "forbidden" as const };

  const quoteReference = text(shipmentData.quote_reference);
  const customerId = nullable(shipmentData.customer_id);
  const [quote, customer, tasksSnapshot, customsSnapshot, costsSnapshot, invoicesSnapshot] = await Promise.all([
    quoteReference ? db.collection("quotes").doc(quoteReference).get() : Promise.resolve(null),
    customerId ? db.collection("customers").doc(customerId).get() : Promise.resolve(null),
    shipmentRef.collection("job_tasks").orderBy("created_at", "desc").limit(500).get(),
    shipmentRef.collection("customs_steps").orderBy("created_at", "asc").limit(300).get(),
    context.permissions.canManageJobCosts
      ? shipmentRef.collection("job_costs").orderBy("created_at", "desc").limit(500).get()
      : Promise.resolve(null),
    context.permissions.canManageJobCosts
      ? db.collection("invoices").where("shipment_reference", "==", id).limit(500).get()
      : Promise.resolve(null),
  ]);

  const quoteData = quote?.exists ? quote.data() as Record<string, unknown> : {};
  const tasks = tasksSnapshot.docs.map((doc) => taskFromDoc(doc.id, doc.data() as Record<string, unknown>));
  const customsSteps = customsSnapshot.docs.map((doc) => customsFromDoc(doc.id, doc.data() as Record<string, unknown>));
  const costs = costsSnapshot ? costsSnapshot.docs.map((doc) => costFromDoc(doc.id, doc.data() as Record<string, unknown>)) : [];
  const costTotals: Partial<Record<CrmCurrency, number>> = {};
  for (const cost of costs) costTotals[cost.currency] = (costTotals[cost.currency] ?? 0) + cost.amount;

  const revenueTotals: Partial<Record<CrmCurrency, number>> = {};
  if (invoicesSnapshot) {
    for (const invoice of invoicesSnapshot.docs) {
      const status = text(invoice.get("status"));
      if (status === "draft" || status === "void") continue;
      const currency = currencyValue(invoice.get("currency"));
      revenueTotals[currency] = (revenueTotals[currency] ?? 0) + numberValue(invoice.get("total"));
    }
  }

  const profitTotals: Partial<Record<CrmCurrency, number>> = {};
  const marginPercent: Partial<Record<CrmCurrency, number>> = {};
  const profitabilityCurrencies = new Set<CrmCurrency>([
    ...Object.keys(costTotals) as CrmCurrency[],
    ...Object.keys(revenueTotals) as CrmCurrency[],
  ]);
  for (const currency of profitabilityCurrencies) {
    const revenue = revenueTotals[currency] ?? 0;
    const cost = costTotals[currency] ?? 0;
    const profit = revenue - cost;
    profitTotals[currency] = profit;
    if (revenue > 0) marginPercent[currency] = Math.round((profit / revenue) * 10000) / 100;
  }

  const job: DigitalJobFile = {
    reference: id,
    quote_reference: quoteReference,
    customer_id: customerId,
    customer_name: customer?.exists ? text(customer.get("display_name"), customerId ?? "") : null,
    status: statusValue(shipmentData.status),
    origin: text(quoteData.origin),
    destination: text(quoteData.destination),
    mode: text(quoteData.mode),
    eta: nullable(shipmentData.eta),
    current_location: nullable(shipmentData.current_location),
    carrier: nullable(shipmentData.carrier),
    carrier_reference: nullable(shipmentData.carrier_reference),
    primary_branch: primary,
    handling_branches: handling,
    assigned_to_name: nullable(shipmentData.job_assigned_to_name),
    assigned_to_email: nullable(shipmentData.job_assigned_to_email),
    assigned_to_phone: nullable(shipmentData.job_assigned_to_phone),
    priority: priorityValue(shipmentData.job_priority),
    internal_reference: nullable(shipmentData.internal_job_reference),
    internal_notes: nullable(shipmentData.internal_job_notes),
    tasks,
    customs_steps: customsSteps,
    costs,
    cost_totals: costTotals,
    revenue_totals: revenueTotals,
    profit_totals: profitTotals,
    margin_percent: marginPercent,
    can_view_costs: context.permissions.canManageJobCosts,
    updated_at: text(shipmentData.updated_at),
  };
  return { kind: "ready" as const, job };
}

export async function updateDigitalJobFile(
  reference: string,
  values: {
    primaryBranch?: KcplBranch;
    handlingBranches?: KcplBranch[];
    assignedToName: string;
    assignedToEmail: string;
    assignedToPhone: string;
    priority: JobPriority;
    internalReference: string;
    internalNotes: string;
  },
  actor: Actor,
  context: KcplStaffContext,
) {
  const loaded = await getDigitalJobFile(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const db = firebaseAdminDb();
  const ref = db.collection("shipments").doc(loaded.job.reference);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    job_assigned_to_name: values.assignedToName.trim() || null,
    job_assigned_to_email: values.assignedToEmail.trim() || null,
    job_assigned_to_phone: values.assignedToPhone.trim() || null,
    job_priority: values.priority,
    internal_job_reference: values.internalReference.trim() || null,
    internal_job_notes: values.internalNotes.trim() || null,
    updated_at: now,
  };
  if (context.permissions.role === "management" && values.primaryBranch) {
    update.primary_branch = values.primaryBranch;
    const branches = values.handlingBranches?.filter((branch) => kcplBranches.includes(branch)) ?? [values.primaryBranch];
    if (!branches.includes(values.primaryBranch)) branches.unshift(values.primaryBranch);
    update.handling_branches = branches;
  }
  await ref.update(update);
  await ref.collection("job_activity").doc(childId("activity")).create({
    type: "job_updated",
    title: "Digital Job File updated",
    detail: `Updated by ${actor.name}.`,
    created_at: now,
    actor_name: actor.name,
    actor_email: actor.email,
  });
  return { kind: "updated" as const };
}

export async function addJobTask(reference: string, input: {
  title: string; detail: string; branch: KcplBranch; dueAt: string; assignedToName: string; assignedToEmail: string; assignedToPhone: string;
}, actor: Actor, context: KcplStaffContext) {
  const loaded = await getDigitalJobFile(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (!loaded.job.handling_branches.includes(input.branch)) return { kind: "invalid_branch" as const };
  const ref = firebaseAdminDb().collection("shipments").doc(loaded.job.reference);
  const id = childId("task");
  const now = new Date().toISOString();
  const task = {
    title: input.title.trim(), detail: input.detail.trim() || null, branch: input.branch, due_at: input.dueAt || null,
    assigned_to_name: input.assignedToName.trim() || null, assigned_to_email: input.assignedToEmail.trim() || null, assigned_to_phone: input.assignedToPhone.trim() || null,
    completed: false, completed_at: null, created_at: now, created_by: actor.email,
  };
  await ref.collection("job_tasks").doc(id).create(task);
  return { kind: "created" as const, task: taskFromDoc(id, task) };
}

export async function toggleJobTask(reference: string, taskId: string, completed: boolean, actor: Actor, context: KcplStaffContext) {
  const loaded = await getDigitalJobFile(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const ref = firebaseAdminDb().collection("shipments").doc(loaded.job.reference).collection("job_tasks").doc(taskId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing_child" as const };
  await ref.update({ completed, completed_at: completed ? new Date().toISOString() : null, completed_by: completed ? actor.email : null });
  return { kind: "updated" as const };
}

export async function addCustomsStep(reference: string, input: {
  title: string; detail: string; branch: KcplBranch; required: boolean;
}, actor: Actor, context: KcplStaffContext) {
  const loaded = await getDigitalJobFile(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (!loaded.job.handling_branches.includes(input.branch)) return { kind: "invalid_branch" as const };
  const ref = firebaseAdminDb().collection("shipments").doc(loaded.job.reference);
  const id = childId("customs");
  const now = new Date().toISOString();
  const step = { title: input.title.trim(), detail: input.detail.trim() || null, branch: input.branch, required: input.required, completed: false, completed_at: null, completed_by: null, created_at: now, created_by: actor.email };
  await ref.collection("customs_steps").doc(id).create(step);
  return { kind: "created" as const, step: customsFromDoc(id, step) };
}

export async function toggleCustomsStep(reference: string, stepId: string, completed: boolean, actor: Actor, context: KcplStaffContext) {
  const loaded = await getDigitalJobFile(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const ref = firebaseAdminDb().collection("shipments").doc(loaded.job.reference).collection("customs_steps").doc(stepId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing_child" as const };
  await ref.update({ completed, completed_at: completed ? new Date().toISOString() : null, completed_by: completed ? actor.email : null });
  return { kind: "updated" as const };
}

export async function addJobCost(reference: string, input: {
  category: JobCostCategory; label: string; vendor: string; amount: number; currency: CrmCurrency; notes: string;
}, actor: Actor, context: KcplStaffContext) {
  if (!context.permissions.canManageJobCosts) return { kind: "forbidden" as const };
  const loaded = await getDigitalJobFile(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const ref = firebaseAdminDb().collection("shipments").doc(loaded.job.reference);
  const id = childId("cost");
  const now = new Date().toISOString();
  const cost = {
    category: input.category,
    label: input.label.trim(),
    vendor: input.vendor.trim() || null,
    amount: input.amount,
    currency: input.currency,
    notes: input.notes.trim() || null,
    source_type: "manual",
    source_reference: null,
    locked: false,
    created_at: now,
    created_by: actor.email,
  };
  await ref.collection("job_costs").doc(id).create(cost);
  return { kind: "created" as const, cost: costFromDoc(id, cost) };
}