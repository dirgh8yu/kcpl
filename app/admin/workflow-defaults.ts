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

export type WorkflowDocumentDirection = "import" | "export" | "domestic" | "cross_trade" | "unknown";

export type WorkflowDocumentContext = {
  mode: string;
  origin?: string | null;
  destination?: string | null;
  cargoType?: string | null;
  requirements?: string | null;
  primaryBranch?: KcplBranch | null;
};

export type WorkflowDocumentRequirement = {
  documentType: ShipmentDocumentType;
  required: boolean;
  reason: string;
  source: "core" | "mode" | "route" | "cargo" | "instruction";
  advisory?: boolean;
};

export type WorkflowDocumentIntelligence = {
  direction: WorkflowDocumentDirection;
  requirements: WorkflowDocumentRequirement[];
  rulesApplied: string[];
  advisories: string[];
};

const nepalLocationSignals = [
  "nepal",
  "kathmandu",
  "birgunj",
  "birgunj",
  "nepalgunj",
  "surkhet",
  "biratnagar",
  "bhairahawa",
  "siddharthanagar",
  "pokhara",
];

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function containsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function isNepalLocation(value: string) {
  const location = normalized(value);
  return Boolean(location && containsAny(location, nepalLocationSignals));
}

export function inferWorkflowDocumentDirection(origin = "", destination = ""): WorkflowDocumentDirection {
  const from = normalized(origin);
  const to = normalized(destination);
  if (!from || !to) return "unknown";
  const originNepal = isNepalLocation(from);
  const destinationNepal = isNepalLocation(to);
  if (originNepal && destinationNepal) return "domestic";
  if (originNepal && !destinationNepal) return "export";
  if (!originNepal && destinationNepal) return "import";
  return "cross_trade";
}

function upsertRequirement(map: Map<ShipmentDocumentType, WorkflowDocumentRequirement>, next: WorkflowDocumentRequirement) {
  const current = map.get(next.documentType);
  if (!current || next.required || (!current.required && !next.advisory)) map.set(next.documentType, next);
}

export function buildDocumentIntelligence(context: WorkflowDocumentContext): WorkflowDocumentIntelligence {
  const mode = normalized(context.mode);
  const cargo = normalized(context.cargoType);
  const instructions = normalized(context.requirements);
  const combined = `${cargo} ${instructions}`.trim();
  const direction = inferWorkflowDocumentDirection(context.origin ?? "", context.destination ?? "");
  const requirements = new Map<ShipmentDocumentType, WorkflowDocumentRequirement>();
  const rulesApplied: string[] = [];
  const advisories: string[] = [];

  for (const item of [
    { documentType: "commercial_invoice" as const, reason: "Commercial value and customs basis" },
    { documentType: "packing_list" as const, reason: "Cargo content, quantity and packing verification" },
    { documentType: "customs_document" as const, reason: "Customs entry, release or clearance evidence" },
  ]) {
    upsertRequirement(requirements, { ...item, required: true, source: "core" });
  }
  rulesApplied.push("Core commercial and customs pack");

  if (mode === "air") {
    upsertRequirement(requirements, { documentType: "air_waybill", required: true, reason: "Primary air carriage document", source: "mode" });
    rulesApplied.push("Air carriage document");
  } else if (mode === "sea" || mode === "ocean") {
    upsertRequirement(requirements, { documentType: "bill_of_lading", required: true, reason: "Primary ocean carriage document", source: "mode" });
    rulesApplied.push("Ocean carriage document");
  } else if (mode === "road") {
    upsertRequirement(requirements, { documentType: "road_consignment_note", required: true, reason: "Primary road carriage / consignment record", source: "mode" });
    rulesApplied.push("Road carriage document");
  }

  if (direction === "import" && (mode === "sea" || mode === "ocean")) {
    upsertRequirement(requirements, {
      documentType: "delivery_order",
      required: true,
      reason: "KCPL sea-import release control. Verify carrier or agent delivery-order release before final handoff.",
      source: "route",
    });
    rulesApplied.push("Sea import release document");
  }

  const certificateExplicit = containsAny(instructions, ["certificate of origin", "origin certificate", " coo", "coo "]);
  if (certificateExplicit) {
    upsertRequirement(requirements, { documentType: "certificate_of_origin", required: true, reason: "Customer or shipment instructions explicitly require a certificate of origin", source: "instruction" });
    rulesApplied.push("Explicit certificate-of-origin instruction");
  } else if (["import", "export", "cross_trade"].includes(direction)) {
    upsertRequirement(requirements, { documentType: "certificate_of_origin", required: false, advisory: true, reason: "International movement: verify whether origin evidence is required by the customer, customs regime or trade preference", source: "route" });
    advisories.push("Verify certificate-of-origin requirements for this international lane.");
  }

  const importPermitExplicit = containsAny(instructions, ["import permit", "import licence", "import license"]);
  const exportPermitExplicit = containsAny(instructions, ["export permit", "export licence", "export license"]);
  const genericPermitExplicit = containsAny(instructions, ["permit required", "licence required", "license required"]);
  const regulatedCargoSignal = containsAny(combined, [
    "pharmaceutical",
    "medicine",
    "medical device",
    "food",
    "agricultural",
    "plant",
    "animal",
    "chemical",
    "radio",
    "telecom",
    "weapon",
    "controlled goods",
    "restricted goods",
  ]);

  if (direction === "import" && (importPermitExplicit || genericPermitExplicit)) {
    upsertRequirement(requirements, { documentType: "import_permit", required: true, reason: "Shipment instructions explicitly indicate an import permit or licence is required", source: "instruction" });
    rulesApplied.push("Explicit import-permit instruction");
  } else if (direction === "import" && regulatedCargoSignal) {
    upsertRequirement(requirements, { documentType: "import_permit", required: false, advisory: true, reason: "Cargo description may fall into a controlled category. Verify import permit/licence requirements with the relevant customs authority.", source: "cargo" });
    advisories.push("Cargo may require an import permit or licence. Customs verification is required.");
  }

  if (direction === "export" && (exportPermitExplicit || genericPermitExplicit)) {
    upsertRequirement(requirements, { documentType: "export_permit", required: true, reason: "Shipment instructions explicitly indicate an export permit or licence is required", source: "instruction" });
    rulesApplied.push("Explicit export-permit instruction");
  } else if (direction === "export" && regulatedCargoSignal) {
    upsertRequirement(requirements, { documentType: "export_permit", required: false, advisory: true, reason: "Cargo description may fall into a controlled category. Verify export permit/licence requirements with the relevant customs authority.", source: "cargo" });
    advisories.push("Cargo may require an export permit or licence. Customs verification is required.");
  }

  const dangerousGoodsSignal = containsAny(combined, ["dangerous goods", "hazardous", "hazmat", "lithium battery", "lithium-ion", "lithium ion", "un3480", "un3481", "un3090", "un3091"]);
  if (dangerousGoodsSignal) {
    upsertRequirement(requirements, {
      documentType: "dangerous_goods_declaration",
      required: true,
      reason: "Cargo or shipment instructions indicate dangerous-goods handling. Declaration/documentation must be verified before controlled progression.",
      source: "cargo",
    });
    rulesApplied.push("Dangerous-goods cargo signal");
    advisories.push("Dangerous-goods handling was inferred from shipment text. Staff must verify classification and carrier requirements.");
  }

  if (containsAny(instructions, ["insurance certificate", "cargo insurance", "insured shipment", "insurance required"])) {
    upsertRequirement(requirements, { documentType: "insurance_certificate", required: true, reason: "Shipment instructions explicitly require cargo insurance evidence", source: "instruction" });
    rulesApplied.push("Explicit cargo-insurance instruction");
  }

  return {
    direction,
    requirements: [...requirements.values()],
    rulesApplied,
    advisories,
  };
}

export function defaultDocumentRequirements(mode: string): WorkflowDocumentRequirement[] {
  return buildDocumentIntelligence({ mode }).requirements;
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
  const modeLabel = mode.trim().toLowerCase();
  const carriageLabel = modeLabel === "air" ? "AWB" : modeLabel === "sea" || modeLabel === "ocean" ? "BL" : modeLabel === "road" ? "road consignment note" : "carriage document";
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
