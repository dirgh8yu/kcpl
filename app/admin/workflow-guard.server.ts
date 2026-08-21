import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../shipment-document-types";
import { shipmentStatuses, type ShipmentStatus } from "../shipment-types";
import { customsClearanceStatusValue, customsReleaseRequired } from "./customs/customs-policy";
import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "./staff-directory.server";
import { buildDocumentIntelligence } from "./workflow-defaults";
import type { ShipmentWorkflowReadiness, WorkflowDocumentState, WorkflowStage } from "./workflow-guard";

type Actor = { name: string; email: string };

type WorkflowSource = {
  reference: string;
  shipment: FirebaseFirestore.DocumentSnapshot;
  data: Record<string, unknown>;
  quote: Record<string, unknown>;
  branch: KcplBranch;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function branchValue(value: unknown, fallback: KcplBranch = "Kathmandu"): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : fallback;
}

function statusValue(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function childId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

async function loadWorkflowSource(reference: string, context?: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = reference.trim().toUpperCase();
  const shipment = await db.collection("shipments").doc(id).get();
  if (!shipment.exists) return { kind: "missing" as const };
  const data = shipment.data() as Record<string, unknown>;
  const customerId = nullable(data.customer_id);
  const customer = customerId ? await db.collection("customers").doc(customerId).get() : null;
  const branch = branchValue(data.primary_branch, branchValue(customer?.get("primary_branch")));
  if (context && !staffCanAccessBranch(context, branch)) return { kind: "forbidden" as const };
  const quoteReference = nullable(data.quote_reference);
  const quote = quoteReference ? await db.collection("quotes").doc(quoteReference).get() : null;
  return {
    kind: "ready" as const,
    source: {
      reference: id,
      shipment,
      data,
      quote: quote?.exists ? quote.data() as Record<string, unknown> : {},
      branch,
    } satisfies WorkflowSource,
  };
}

function stageState(complete: boolean, current: boolean, blocked = false): WorkflowStage["state"] {
  if (complete) return "complete";
  if (blocked) return "blocked";
  return current ? "current" : "pending";
}

export async function getShipmentWorkflowReadiness(reference: string, context?: KcplStaffContext) {
  const loaded = await loadWorkflowSource(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const { source } = loaded;
  const db = firebaseAdminDb();
  const shipmentRef = source.shipment.ref;
  const status = statusValue(source.data.status);
  const customerId = nullable(source.data.customer_id);
  const customerLinked = Boolean(customerId);
  const assignedOwner = Boolean(nullable(source.data.job_assigned_to_name) || nullable(source.data.job_assigned_to_email));

  const [tasksSnapshot, customsSnapshot, documentsSnapshot, requirementsSnapshot, invoicesSnapshot] = await Promise.all([
    shipmentRef.collection("job_tasks").limit(1000).get(),
    shipmentRef.collection("customs_steps").limit(500).get(),
    shipmentRef.collection("documents").limit(1000).get(),
    shipmentRef.collection("document_requirements").limit(100).get(),
    db.collection("invoices").where("shipment_reference", "==", source.reference).limit(1000).get(),
  ]);

  const openTasks = tasksSnapshot.docs.filter((doc) => doc.get("completed") !== true).length;
  const requiredCustoms = customsSnapshot.docs.filter((doc) => doc.get("required") !== false);
  const completedCustoms = requiredCustoms.filter((doc) => doc.get("completed") === true).length;
  const customsStepsComplete = requiredCustoms.length === 0 || completedCustoms === requiredCustoms.length;

  const documentCounts = new Map<ShipmentDocumentType, number>();
  for (const doc of documentsSnapshot.docs) {
    const type = doc.get("document_type");
    if (!shipmentDocumentTypeLabels[type as ShipmentDocumentType]) continue;
    const typed = type as ShipmentDocumentType;
    documentCounts.set(typed, (documentCounts.get(typed) ?? 0) + 1);
  }

  const intelligence = buildDocumentIntelligence({
    mode: text(source.quote.mode),
    origin: nullable(source.quote.origin),
    destination: nullable(source.quote.destination),
    cargoType: nullable(source.quote.cargo_type),
    requirements: nullable(source.quote.requirements),
    primaryBranch: source.branch,
  });
  const customsReleaseIsRequired = customsReleaseRequired(intelligence.direction);
  const customsClearanceStatus = customsClearanceStatusValue(source.data.customs_clearance_status);
  const customsChecklistReady = customsReleaseIsRequired
    ? requiredCustoms.length > 0 && customsStepsComplete
    : customsStepsComplete;
  const customsReleased = !customsReleaseIsRequired || customsClearanceStatus === "released";
  const customsReady = customsChecklistReady && customsReleased;

  const requirementOverrides = new Map<ShipmentDocumentType, { required: boolean; reason: string; advisory: boolean; source: "shipment_override" }>();
  for (const doc of requirementsSnapshot.docs) {
    const documentType = (doc.get("document_type") || doc.id) as ShipmentDocumentType;
    if (!shipmentDocumentTypeLabels[documentType]) continue;
    const storedSource = text(doc.get("source"));
    if (storedSource === "workflow_default" || storedSource === "smart_rule") continue;
    requirementOverrides.set(documentType, {
      required: doc.get("required") === true,
      advisory: doc.get("advisory") === true,
      reason: text(doc.get("reason"), "Shipment-specific document requirement"),
      source: "shipment_override",
    });
  }

  const baseRequirements = new Map<ShipmentDocumentType, { required: boolean; reason: string; advisory: boolean; source: WorkflowDocumentState["source"] }>();
  for (const item of intelligence.requirements) {
    baseRequirements.set(item.documentType, {
      required: item.required,
      reason: item.reason,
      advisory: item.advisory === true,
      source: item.source,
    });
  }
  for (const [type, override] of requirementOverrides) baseRequirements.set(type, override);

  const documents: WorkflowDocumentState[] = [...baseRequirements.entries()].map(([documentType, requirement]) => ({
    document_type: documentType,
    label: shipmentDocumentTypeLabels[documentType],
    required: requirement.required,
    advisory: requirement.advisory,
    present: (documentCounts.get(documentType) ?? 0) > 0,
    count: documentCounts.get(documentType) ?? 0,
    reason: requirement.reason,
    source: requirement.source,
  }));

  const operationalRequiredDocuments = documents.filter((item) => item.required && item.document_type !== "proof_of_delivery");
  const documentPackReady = operationalRequiredDocuments.every((item) => item.present);
  const proofOfDeliveryPresent = (documentCounts.get("proof_of_delivery") ?? 0) > 0;

  const invoices = invoicesSnapshot.docs.map((doc) => text(doc.get("status"), "draft"));
  const invoiceCount = invoices.filter((statusItem) => statusItem !== "void").length;
  const issuedInvoiceCount = invoices.filter((statusItem) => !["draft", "void"].includes(statusItem)).length;
  const paidInvoiceCount = invoices.filter((statusItem) => statusItem === "paid").length;
  const billingReady = customerLinked && issuedInvoiceCount > 0;

  const jobClosedAt = nullable(source.data.job_closed_at);
  const jobClosed = Boolean(jobClosedAt);
  const blockers: string[] = [];
  const warnings: string[] = [...intelligence.advisories];
  if (!customerLinked) blockers.push("Link this shipment to a CRM customer before controlled operational progression.");
  if (!customsChecklistReady) {
    if (customsReleaseIsRequired && requiredCustoms.length === 0) blockers.push("International shipment has no required customs checklist. Repair the Job File before controlled progression.");
    else blockers.push(`${requiredCustoms.length - completedCustoms} required customs step${requiredCustoms.length - completedCustoms === 1 ? " is" : "s are"} still open.`);
  }
  if (customsReleaseIsRequired && !customsReleased) {
    const holdReason = nullable(source.data.customs_hold_reason);
    blockers.push(customsClearanceStatus === "held"
      ? `Customs hold must be resolved before final-mile progression${holdReason ? `: ${holdReason}` : "."}`
      : "Record explicit Customs release before final-mile progression.");
  }
  if (!documentPackReady) {
    const missing = operationalRequiredDocuments.filter((item) => !item.present).map((item) => item.label);
    blockers.push(`Required document pack incomplete: ${missing.join(", ")}.`);
  }
  if (!assignedOwner) warnings.push("No operational owner is assigned to this Job File.");
  if (!billingReady) warnings.push(invoiceCount ? "Finance exists, but no invoice has been issued yet." : "No customer invoice has been created yet. Finance can continue in parallel with operations.");

  const closeBlockers: string[] = [];
  if (status !== "delivered") closeBlockers.push("Shipment must be marked Delivered before the Job File can close.");
  if (!customerLinked) closeBlockers.push("A CRM customer must be confirmed.");
  if (!customsChecklistReady) closeBlockers.push("All required customs checklist steps must be complete.");
  if (customsReleaseIsRequired && !customsReleased) closeBlockers.push("Explicit Customs release must be recorded for this international shipment.");
  if (!documentPackReady) closeBlockers.push("All required operational documents must be present.");
  if (!proofOfDeliveryPresent) closeBlockers.push("Proof of Delivery (POD) must be uploaded.");
  if (openTasks > 0) closeBlockers.push(`${openTasks} operational task${openTasks === 1 ? " remains" : "s remain"} open.`);

  const inTransitOrLater = ["in_transit", "customs_clearance", "out_for_delivery", "delivered"].includes(status);
  const outForDeliveryOrLater = ["out_for_delivery", "delivered"].includes(status);
  const delivered = status === "delivered";
  const customsStageDetail = !customsChecklistReady
    ? `${completedCustoms}/${requiredCustoms.length} required customs steps complete.`
    : customsReleaseIsRequired
      ? customsReleased ? "Customs checklist complete and explicit release recorded." : `Checklist complete. Customs status is ${customsClearanceStatus.replaceAll("_", " ")}; explicit release is still required.`
      : "Customs checklist complete. Explicit release is not required by the current lane rule.";
  const stages: WorkflowStage[] = [
    { id: "won", label: "Won", state: "complete", detail: "Shipment and Job File created from an accepted quote." },
    { id: "setup", label: "Setup", state: stageState(customerLinked, !customerLinked), detail: customerLinked ? `CRM customer ${customerId} confirmed.` : "Confirm or create the CRM customer before progression." },
    { id: "customs", label: "Customs", state: stageState(customsReady, customerLinked && !customsReady, customsClearanceStatus === "held"), detail: customsStageDetail },
    { id: "documents", label: "Docs", state: stageState(documentPackReady, customsReady && !documentPackReady), detail: documentPackReady ? "Smart required document pack present." : "Smart document rules identify missing required documents." },
    { id: "transit", label: "Transit", state: stageState(inTransitOrLater, customsReady && documentPackReady && !inTransitOrLater), detail: inTransitOrLater ? "Movement has reached transit/clearance stage." : "Movement milestone not reached yet." },
    { id: "delivery", label: "Delivery", state: stageState(delivered, outForDeliveryOrLater && !delivered), detail: delivered ? "Cargo marked delivered." : status === "out_for_delivery" ? "Final-mile delivery is active." : "Delivery not yet reached." },
    { id: "pod", label: "POD", state: stageState(proofOfDeliveryPresent, delivered && !proofOfDeliveryPresent, delivered && !proofOfDeliveryPresent), detail: proofOfDeliveryPresent ? "Proof of Delivery captured." : "POD required for operational closeout." },
    { id: "close", label: "Close", state: stageState(jobClosed, delivered && proofOfDeliveryPresent && !jobClosed, closeBlockers.length > 0 && delivered), detail: jobClosed ? `Job closed ${jobClosedAt}.` : closeBlockers.length ? `${closeBlockers.length} closeout blocker${closeBlockers.length === 1 ? "" : "s"}.` : "Ready for operational closeout." },
  ];

  const readiness: ShipmentWorkflowReadiness = {
    reference: source.reference,
    status,
    customer_id: customerId,
    customer_linked: customerLinked,
    assigned_owner: assignedOwner,
    customs_required: requiredCustoms.length,
    customs_completed: completedCustoms,
    customs_checklist_ready: customsChecklistReady,
    customs_release_required: customsReleaseIsRequired,
    customs_clearance_status: customsClearanceStatus,
    customs_released: customsReleased,
    customs_ready: customsReady,
    open_tasks: openTasks,
    documents,
    document_intelligence: {
      direction: intelligence.direction,
      origin: text(source.quote.origin),
      destination: text(source.quote.destination),
      mode: text(source.quote.mode),
      cargo_type: nullable(source.quote.cargo_type),
      rules_applied: intelligence.rulesApplied,
      advisories: intelligence.advisories,
    },
    document_pack_ready: documentPackReady,
    proof_of_delivery_present: proofOfDeliveryPresent,
    invoice_count: invoiceCount,
    issued_invoice_count: issuedInvoiceCount,
    paid_invoice_count: paidInvoiceCount,
    billing_ready: billingReady,
    job_closed: jobClosed,
    job_closed_at: jobClosedAt,
    job_closed_by_name: nullable(source.data.job_closed_by_name),
    blockers,
    warnings,
    close_blockers: closeBlockers,
    can_close: closeBlockers.length === 0 && !jobClosed,
    stages,
  };
  return { kind: "ready" as const, readiness };
}

const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  booking_confirmed: ["preparing", "exception"],
  preparing: ["booking_confirmed", "in_transit", "customs_clearance", "exception"],
  in_transit: ["preparing", "customs_clearance", "out_for_delivery", "exception"],
  customs_clearance: ["preparing", "in_transit", "out_for_delivery", "exception"],
  out_for_delivery: ["in_transit", "customs_clearance", "delivered", "exception"],
  delivered: ["exception"],
  exception: ["preparing", "in_transit", "customs_clearance", "out_for_delivery"],
};

export async function validateShipmentTransition(
  reference: string,
  nextStatus: ShipmentStatus,
  context: KcplStaffContext,
  overrideReason = "",
) {
  const result = await getShipmentWorkflowReadiness(reference, context);
  if (result.kind !== "ready") return result;
  const readiness = result.readiness;
  const blockers: string[] = [];
  if (readiness.job_closed) blockers.push("This Job File is closed. Reopen it before changing shipment status.");
  if (readiness.status !== nextStatus && !allowedTransitions[readiness.status].includes(nextStatus)) {
    blockers.push(`Status cannot move directly from ${readiness.status.replaceAll("_", " ")} to ${nextStatus.replaceAll("_", " ")}.`);
  }
  if (["out_for_delivery", "delivered"].includes(nextStatus)) {
    if (!readiness.customer_linked) blockers.push("Confirm the CRM customer before final-mile delivery.");
    if (!readiness.customs_checklist_ready) blockers.push("Complete the required customs checklist before final-mile delivery.");
    if (readiness.customs_release_required && !readiness.customs_released) blockers.push("Record explicit Customs release before final-mile delivery.");
    if (!readiness.document_pack_ready) blockers.push("Complete the required operational document pack before final-mile delivery.");
  }
  if (nextStatus === "delivered" && readiness.status !== "out_for_delivery") {
    blockers.push("Move the shipment to Out for delivery before marking it Delivered.");
  }

  if (!blockers.length) return { kind: "allowed" as const, readiness, overrideUsed: false, overrideReason: "" };
  const reason = overrideReason.trim();
  if (context.permissions.role === "management" && reason.length >= 8) {
    return { kind: "allowed" as const, readiness, overrideUsed: true, overrideReason: reason, blockers };
  }
  return { kind: "blocked" as const, readiness, blockers, canOverride: context.permissions.role === "management" };
}

export async function recordWorkflowOverride(reference: string, fromStatus: ShipmentStatus, toStatus: ShipmentStatus, reason: string, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return;
  const now = new Date().toISOString();
  const ref = firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase());
  await ref.collection("job_activity").doc(childId("override")).create({
    type: "workflow_override",
    title: "Workflow guard overridden",
    detail: `${fromStatus} → ${toStatus}. Reason: ${reason}`,
    from_status: fromStatus,
    to_status: toStatus,
    reason,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
}

export async function closeShipmentJob(reference: string, actor: Actor, context: KcplStaffContext, overrideReason = "") {
  const result = await getShipmentWorkflowReadiness(reference, context);
  if (result.kind !== "ready") return result;
  if (result.readiness.job_closed) return { kind: "already_closed" as const, readiness: result.readiness };
  const reason = overrideReason.trim();
  const useOverride = result.readiness.close_blockers.length > 0 && context.permissions.role === "management" && reason.length >= 8;
  if (result.readiness.close_blockers.length > 0 && !useOverride) {
    return { kind: "blocked" as const, readiness: result.readiness, blockers: result.readiness.close_blockers, canOverride: context.permissions.role === "management" };
  }

  const db = firebaseAdminDb();
  const ref = db.collection("shipments").doc(result.readiness.reference);
  const now = new Date().toISOString();
  const batch = db.batch();
  batch.update(ref, {
    job_closed_at: now,
    job_closed_by_name: actor.name,
    job_closed_by_email: actor.email,
    job_close_note: useOverride ? reason : null,
    job_close_overridden: useOverride,
    updated_at: now,
  });
  batch.create(ref.collection("job_activity").doc(childId("close")), {
    type: useOverride ? "job_closed_override" : "job_closed",
    title: useOverride ? "Job closed with management override" : "Digital Job File closed",
    detail: useOverride ? reason : "All operational closeout controls satisfied.",
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  const refreshed = await getShipmentWorkflowReadiness(result.readiness.reference, context);
  return { kind: "closed" as const, readiness: refreshed.kind === "ready" ? refreshed.readiness : result.readiness, overrideUsed: useOverride };
}

export async function reopenShipmentJob(reference: string, actor: Actor, context: KcplStaffContext, reason: string) {
  if (context.permissions.role !== "management") return { kind: "forbidden" as const };
  const loaded = await loadWorkflowSource(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const why = reason.trim();
  if (why.length < 8) return { kind: "reason_required" as const };
  if (!nullable(loaded.source.data.job_closed_at)) return { kind: "not_closed" as const };
  const now = new Date().toISOString();
  const ref = loaded.source.shipment.ref;
  const batch = firebaseAdminDb().batch();
  batch.update(ref, {
    job_closed_at: null,
    job_closed_by_name: null,
    job_closed_by_email: null,
    job_close_note: null,
    job_close_overridden: false,
    updated_at: now,
  });
  batch.create(ref.collection("job_activity").doc(childId("reopen")), {
    type: "job_reopened",
    title: "Digital Job File reopened",
    detail: why,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  const refreshed = await getShipmentWorkflowReadiness(loaded.source.reference, context);
  return { kind: "reopened" as const, readiness: refreshed.kind === "ready" ? refreshed.readiness : null };
}
