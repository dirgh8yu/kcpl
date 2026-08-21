import type { ShipmentDocumentType } from "../shipment-document-types";
import type { ShipmentStatus } from "../shipment-types";

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
  present: boolean;
  count: number;
  reason: string;
};

export type ShipmentWorkflowReadiness = {
  reference: string;
  status: ShipmentStatus;
  customer_id: string | null;
  customer_linked: boolean;
  assigned_owner: boolean;
  customs_required: number;
  customs_completed: number;
  customs_ready: boolean;
  open_tasks: number;
  documents: WorkflowDocumentState[];
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
