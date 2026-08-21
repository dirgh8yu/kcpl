import type { KcplBranch } from "./crm/crm-data";
import type { ShipmentDocumentType } from "../shipment-document-types";

export type WorkflowSeedTask = {
  title: string;
  detail: string;
  branch: KcplBranch;
};

export type WorkflowSeedCustomsStep = {
  title: string;
  detail: string;
  branch: KcplBranch;
  required: boolean;
};

export type WorkflowDocumentRequirement = {
  documentType: ShipmentDocumentType;
  required: boolean;
  reason: string;
};

export function defaultDocumentRequirements(mode: string): WorkflowDocumentRequirement[] {
  const normalized = mode.trim().toLowerCase();
  const requirements: WorkflowDocumentRequirement[] = [
    { documentType: "commercial_invoice", required: true, reason: "Commercial value and customs basis" },
    { documentType: "packing_list", required: true, reason: "Cargo content, quantity and packing verification" },
    { documentType: "customs_document", required: true, reason: "Customs entry, release or clearance evidence" },
  ];

  if (normalized === "air") {
    requirements.push({ documentType: "air_waybill", required: true, reason: "Primary air carriage document" });
  } else if (normalized === "sea" || normalized === "ocean") {
    requirements.push({ documentType: "bill_of_lading", required: true, reason: "Primary ocean carriage document" });
  } else if (normalized === "road") {
    requirements.push({ documentType: "road_consignment_note", required: true, reason: "Primary road carriage / consignment record" });
  }

  return requirements;
}

export function defaultWorkflowTasks(mode: string, branch: KcplBranch): WorkflowSeedTask[] {
  const modeLabel = mode.trim() ? `${mode.trim()} freight` : "freight";
  return [
    {
      title: "Confirm booking and customer instructions",
      detail: "Verify the accepted quote, cargo particulars, contacts, pickup/delivery instructions and any special handling before movement begins.",
      branch,
    },
    {
      title: "Confirm transport plan and handoffs",
      detail: `Confirm the ${modeLabel} movement plan, carrier/agent handoffs, route and operational ownership.`,
      branch,
    },
    {
      title: "Verify required document pack",
      detail: "Check that required commercial, carriage and customs documents are present and usable before the shipment reaches its next controlled milestone.",
      branch,
    },
    {
      title: "Monitor movement milestones",
      detail: "Keep location, ETA, carrier reference and customer-facing shipment events current throughout transit.",
      branch,
    },
    {
      title: "Prepare delivery and closeout",
      detail: "Confirm final delivery instructions, capture proof of delivery and close remaining operational tasks before closing the job.",
      branch,
    },
  ];
}

export function defaultCustomsSteps(mode: string, branch: KcplBranch): WorkflowSeedCustomsStep[] {
  const normalized = mode.trim().toLowerCase();
  const carriageLabel = normalized === "air" ? "AWB" : normalized === "sea" || normalized === "ocean" ? "BL" : normalized === "road" ? "road consignment note" : "carriage document";
  return [
    {
      title: "Confirm HS code and commodity description",
      detail: "Verify classification and a customs-ready commodity description against the commercial documents.",
      branch,
      required: true,
    },
    {
      title: "Validate commercial invoice and packing list",
      detail: "Check values, quantities, weights, consignee/shipper details and consistency across the customs document pack.",
      branch,
      required: true,
    },
    {
      title: `Verify ${carriageLabel} details`,
      detail: "Confirm the primary carriage reference and that the transport document agrees with the shipment record.",
      branch,
      required: true,
    },
    {
      title: "Coordinate customs declaration / entry",
      detail: "Record that the declaration, entry or broker handoff has been lodged or coordinated for the relevant border/customs point.",
      branch,
      required: true,
    },
    {
      title: "Record customs release",
      detail: "Complete only after customs release/clearance is confirmed and any operational hold has been resolved.",
      branch,
      required: true,
    },
  ];
}
