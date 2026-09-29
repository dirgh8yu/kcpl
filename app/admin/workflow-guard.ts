import type { ShipmentDocumentType } from "../shipment-document-types";
import type { ShipmentStatus } from "../shipment-types";
import type { CustomsClearanceStatus } from "./customs/customs-policy";
import type { WorkflowDocumentDirection } from "./workflow-defaults";

export const workflowStageIds = ["won", "setup", "customs", "documents", "transit", "delivery", "pod", "close"] as const;
export type WorkflowStageId = (typeof workflowStageIds)[number];
export type WorkflowStageState = "complete" | "current" | "blocked" | "pending";

export type WorkflowStage = {
  id: WorkflowStageId;
  label: string;
  state: WorkflowStageState;
  detail: string;
};

export type WorkflowDocumentState = {
  document_type: ShipmentDocumentType;
  label: string;
  required: boolean;
  advisory: boolean;
  present: boolean;
  count: number;
  uploaded_count: number;
  verified_count: number;
  reason: string;
  source: "core" | "mode" | "route" | "cargo" | "instruction" | "shipment_override";
};

export type ShipmentDocumentIntelligence = {
  direction: WorkflowDocumentDirection;
  origin: string;
  destination: string;
  mode: string;
  cargo_type: string | null;
  rules_applied: string[];
  advisories: string[];
};

export type ShipmentWorkflowReadiness = {
  reference: string;
  status: ShipmentStatus;
  customer_id: string | null;
  customer_linked: boolean;
  assigned_owner: boolean;
  customs_required: number;
  customs_completed: number;
  customs_checklist_ready: boolean;
  customs_release_required: boolean;
  customs_clearance_status: CustomsClearanceStatus;
  customs_released: boolean;
  customs_ready: boolean;
  open_tasks: number;
  documents: WorkflowDocumentState[];
  document_intelligence: ShipmentDocumentIntelligence;
  document_pack_ready: boolean;
  proof_of_delivery_present: boolean;
  invoice_count: number;
  issued_invoice_count: number;
  paid_invoice_count: number;
  billing_ready: boolean;
  job_closed: boolean;
  job_closed_at: string | null;
  job_closed_by_name: string | null;
  blockers: string[];
  warnings: string[];
  close_blockers: string[];
  can_close: boolean;
  stages: WorkflowStage[];
};

// Which status a shipment may move to next. The server guard enforces this; the
// Job File reads it to offer only the moves that can succeed.
export const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  booking_confirmed: ["preparing", "exception"],
  preparing: ["booking_confirmed", "in_transit", "customs_clearance", "exception"],
  in_transit: ["preparing", "customs_clearance", "out_for_delivery", "exception"],
  customs_clearance: ["preparing", "in_transit", "out_for_delivery", "exception"],
  out_for_delivery: ["in_transit", "customs_clearance", "delivered", "exception"],
  delivered: ["exception"],
  exception: ["preparing", "in_transit", "customs_clearance", "out_for_delivery"],
};

const forwardStatus: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  booking_confirmed: "preparing",
  preparing: "in_transit",
  in_transit: "out_for_delivery",
  customs_clearance: "out_for_delivery",
};

/** The one obvious next status, or null when the next move is not a status
 * change (Delivered is recorded with proof on the Delivery step). */
export function nextShipmentStatus(status: ShipmentStatus): ShipmentStatus | null {
  return forwardStatus[status] ?? null;
}

/** Every other status the shipment may move to from here, Delivered excluded. */
export function otherShipmentStatuses(status: ShipmentStatus): ShipmentStatus[] {
  const next = nextShipmentStatus(status);
  return allowedTransitions[status].filter((item) => item !== next && item !== "delivered");
}

/** Job File steps a blocker can send staff to. Kept in step with job-steps.ts. */
export type WorkflowFixStep = "booking" | "documents" | "customs" | "delivery" | "proof" | "tasks" | "close";

/** Where a guard blocker is fixed. Blockers are sentences written by the
 * server guard; this reads their subject, so a new blocker without a match
 * simply shows no fix link rather than a wrong one. */
export function workflowBlockerFix(blocker: string): { step: WorkflowFixStep; label: string } | null {
  const text = blocker.toLowerCase();
  if (text.includes("closed")) return { step: "close", label: "Open closeout" };
  // Document sentences list document names ("Customs declaration", "Customer
  // invoice"), so they are recognised by their opening before any name can match.
  if (text.startsWith("documents still needed") || text.includes("required documents")) return { step: "documents", label: "Open documents" };
  if (text.includes("customer")) return { step: "booking", label: "Link the customer" };
  if (text.includes("customs")) return { step: "customs", label: "Open customs" };
  if (text.includes("proof of delivery") || /\bpod\b/.test(text)) return { step: "proof", label: "Open proof of delivery" };
  if (text.includes("document")) return { step: "documents", label: "Open documents" };
  if (text.includes("task")) return { step: "tasks", label: "Open tasks" };
  if (text.includes("delivered")) return { step: "delivery", label: "Open delivery" };
  return null;
}
