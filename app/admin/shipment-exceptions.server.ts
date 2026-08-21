import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "./staff-directory.server";
import {
  shipmentExceptionCategories,
  shipmentExceptionResolutionValid,
  shipmentExceptionSeverities,
  shipmentExceptionSlaDue,
  shipmentExceptionStatuses,
  shipmentExceptionTransitionAllowed,
  summarizeShipmentExceptions,
  type ShipmentException,
  type ShipmentExceptionCategory,
  type ShipmentExceptionSeverity,
  type ShipmentExceptionStatus,
} from "./shipment-exceptions";

type Actor = { name: string; email: string };

type CreateShipmentExceptionInput = {
  category: ShipmentExceptionCategory;
  severity: ShipmentExceptionSeverity;
  title: string;
  detail: string;
  operationalImpact: string;
  branch: KcplBranch;
  assignedToName: string;
  assignedToEmail: string;
};

type UpdateShipmentExceptionInput = {
  status: ShipmentExceptionStatus;
  assignedToName?: string;
  assignedToEmail?: string;
  resolution?: string;
};

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

function branchList(value: unknown) {
  if (!Array.isArray(value)) return [] as KcplBranch[];
  return value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch));
}

function categoryValue(value: unknown): ShipmentExceptionCategory {
  return shipmentExceptionCategories.includes(value as ShipmentExceptionCategory) ? value as ShipmentExceptionCategory : "other";
}

function severityValue(value: unknown): ShipmentExceptionSeverity {
  return shipmentExceptionSeverities.includes(value as ShipmentExceptionSeverity) ? value as ShipmentExceptionSeverity : "medium";
}

function statusValue(value: unknown): ShipmentExceptionStatus {
  return shipmentExceptionStatuses.includes(value as ShipmentExceptionStatus) ? value as ShipmentExceptionStatus : "open";
}

function exceptionFromData(id: string, reference: string, data: Record<string, unknown>): ShipmentException | null {
  const branch = branchValue(data.branch);
  if (!branch) return null;
  return {
    id,
    reference,
    category: categoryValue(data.category),
    severity: severityValue(data.severity),
    status: statusValue(data.status),
    title: text(data.title, "Shipment exception"),
    detail: nullable(data.detail),
    operational_impact: nullable(data.operational_impact),
    branch,
    assigned_to_name: nullable(data.assigned_to_name),
    assigned_to_email: nullable(data.assigned_to_email),
    sla_due_at: text(data.sla_due_at),
    opened_at: text(data.opened_at),
    opened_by_name: nullable(data.opened_by_name),
    opened_by_email: nullable(data.opened_by_email),
    updated_at: text(data.updated_at, text(data.opened_at)),
    updated_by_name: nullable(data.updated_by_name),
    updated_by_email: nullable(data.updated_by_email),
    resolved_at: nullable(data.resolved_at),
    resolved_by_name: nullable(data.resolved_by_name),
    resolved_by_email: nullable(data.resolved_by_email),
    resolution: nullable(data.resolution),
  };
}

async function shipmentScope(reference: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const id = reference.trim().toUpperCase();
  const shipmentRef = firebaseAdminDb().collection("shipments").doc(id);
  const snapshot = await shipmentRef.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const primary = branchValue(data.primary_branch);
  const handling = branchList(data.handling_branches);
  const branches = [...new Set([...(primary ? [primary] : []), ...handling])];
  if (!branches.length) return { kind: "invalid_branch" as const };
  if (!branches.some((branch) => staffCanAccessBranch(context, branch))) return { kind: "forbidden" as const };
  return { kind: "ready" as const, id, shipmentRef, branches };
}

export async function getShipmentExceptions(reference: string, context: KcplStaffContext) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  const snapshot = await scope.shipmentRef.collection("exceptions").limit(500).get();
  const exceptions = snapshot.docs
    .map((doc) => exceptionFromData(doc.id, scope.id, doc.data() as Record<string, unknown>))
    .filter((item): item is ShipmentException => Boolean(item))
    .filter((item) => staffCanAccessBranch(context, item.branch))
    .sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  const nowIso = new Date().toISOString();
  return { kind: "ready" as const, exceptions, summary: summarizeShipmentExceptions(exceptions, nowIso), generated_at: nowIso };
}

export async function createShipmentException(
  reference: string,
  input: CreateShipmentExceptionInput,
  actor: Actor,
  context: KcplStaffContext,
) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  if (!scope.branches.includes(input.branch) || !staffCanAccessBranch(context, input.branch)) return { kind: "invalid_branch" as const };
  if (!shipmentExceptionCategories.includes(input.category)) return { kind: "invalid_category" as const };
  if (!shipmentExceptionSeverities.includes(input.severity)) return { kind: "invalid_severity" as const };

  const openedAt = new Date().toISOString();
  const slaDueAt = shipmentExceptionSlaDue(openedAt, input.severity);
  if (!slaDueAt) return { kind: "invalid_time" as const };
  const exceptionRef = scope.shipmentRef.collection("exceptions").doc();
  const activityRef = scope.shipmentRef.collection("job_activity").doc();
  const data = {
    category: input.category,
    severity: input.severity,
    status: "open" as const,
    title: input.title,
    detail: input.detail || null,
    operational_impact: input.operationalImpact || null,
    branch: input.branch,
    assigned_to_name: input.assignedToName || null,
    assigned_to_email: input.assignedToEmail || null,
    sla_due_at: slaDueAt,
    opened_at: openedAt,
    opened_by_name: actor.name || null,
    opened_by_email: actor.email || null,
    updated_at: openedAt,
    updated_by_name: actor.name || null,
    updated_by_email: actor.email || null,
    resolved_at: null,
    resolved_by_name: null,
    resolved_by_email: null,
    resolution: null,
  };

  const batch = firebaseAdminDb().batch();
  batch.set(exceptionRef, data);
  batch.set(activityRef, {
    type: "shipment_exception_opened",
    title: `${input.severity === "critical" ? "Critical" : input.severity === "high" ? "High" : "Shipment"} exception opened: ${input.title}`,
    detail: [input.operationalImpact, input.assignedToName || input.assignedToEmail ? `Owner: ${input.assignedToName || input.assignedToEmail}` : "Unassigned"].filter(Boolean).join(" · "),
    branch: input.branch,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: openedAt,
    exception_id: exceptionRef.id,
  });
  batch.update(scope.shipmentRef, { updated_at: openedAt });
  await batch.commit();

  return { kind: "created" as const, exception: exceptionFromData(exceptionRef.id, scope.id, data)! };
}

export async function updateShipmentException(
  reference: string,
  exceptionId: string,
  input: UpdateShipmentExceptionInput,
  actor: Actor,
  context: KcplStaffContext,
) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  const exceptionRef = scope.shipmentRef.collection("exceptions").doc(exceptionId.trim());
  const snapshot = await exceptionRef.get();
  if (!snapshot.exists) return { kind: "missing_exception" as const };
  const current = exceptionFromData(snapshot.id, scope.id, snapshot.data() as Record<string, unknown>);
  if (!current) return { kind: "invalid_exception" as const };
  if (!staffCanAccessBranch(context, current.branch)) return { kind: "forbidden" as const };
  if (!shipmentExceptionStatuses.includes(input.status)) return { kind: "invalid_status" as const };
  if (!shipmentExceptionTransitionAllowed(current.status, input.status)) return { kind: "invalid_transition" as const };
  const resolution = input.resolution?.trim() ?? "";
  if (!shipmentExceptionResolutionValid(input.status, resolution)) return { kind: "resolution_required" as const };

  const updatedAt = new Date().toISOString();
  const resolving = input.status === "resolved" && current.status !== "resolved";
  const data: Record<string, unknown> = {
    status: input.status,
    assigned_to_name: input.assignedToName?.trim() || current.assigned_to_name || null,
    assigned_to_email: input.assignedToEmail?.trim().toLowerCase() || current.assigned_to_email || null,
    updated_at: updatedAt,
    updated_by_name: actor.name || null,
    updated_by_email: actor.email || null,
  };
  if (resolving) {
    data.resolution = resolution;
    data.resolved_at = updatedAt;
    data.resolved_by_name = actor.name || null;
    data.resolved_by_email = actor.email || null;
  }

  const activityRef = scope.shipmentRef.collection("job_activity").doc();
  const statusLabel = input.status === "resolved" ? "resolved" : input.status === "monitoring" ? "moved to monitoring" : "reopened";
  const batch = firebaseAdminDb().batch();
  batch.update(exceptionRef, data);
  batch.set(activityRef, {
    type: input.status === "resolved" ? "shipment_exception_resolved" : "shipment_exception_updated",
    title: `Shipment exception ${statusLabel}: ${current.title}`,
    detail: input.status === "resolved" ? resolution : null,
    branch: current.branch,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: updatedAt,
    exception_id: exceptionRef.id,
  });
  batch.update(scope.shipmentRef, { updated_at: updatedAt });
  await batch.commit();

  const merged = { ...(snapshot.data() as Record<string, unknown>), ...data };
  return { kind: "updated" as const, exception: exceptionFromData(exceptionRef.id, scope.id, merged)! };
}
