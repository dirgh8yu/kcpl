import {
  documentCategories,
  documentCategoryLabels,
  type KcplDocumentCategory,
} from "./document-vault";

export type DocumentChecklistSeverity = "info" | "warning" | "critical";

export type DocumentChecklistItem = {
  category: KcplDocumentCategory;
  label: string;
  required: boolean;
  default_required: boolean;
  overridden: boolean;
  present: boolean;
  document_count: number;
};

export type ShipmentDocumentChecklist = {
  shipment_reference: string;
  customer_id: string | null;
  customer_name: string | null;
  branch: string;
  mode: string;
  status: string;
  eta: string | null;
  required_count: number;
  present_required_count: number;
  missing_count: number;
  completion_percent: number;
  severity: DocumentChecklistSeverity;
  missing_labels: string[];
  items: DocumentChecklistItem[];
};

export type DocumentChecklistAlertRow = Pick<
  ShipmentDocumentChecklist,
  | "shipment_reference"
  | "customer_id"
  | "customer_name"
  | "branch"
  | "mode"
  | "status"
  | "eta"
  | "required_count"
  | "present_required_count"
  | "missing_count"
  | "completion_percent"
  | "severity"
  | "missing_labels"
>;

export function defaultDocumentRequirements(mode: string, status = "") {
  const normalizedMode = mode.trim().toLowerCase();
  const normalizedStatus = status.trim().toLowerCase();
  const required = new Set<KcplDocumentCategory>([
    "commercial_invoice",
    "packing_list",
    "customs_declaration",
  ]);

  if (normalizedMode.includes("air") || normalizedMode.includes("flight")) {
    required.add("air_waybill");
  } else if (normalizedMode.includes("sea") || normalizedMode.includes("ocean") || normalizedMode.includes("vessel")) {
    required.add("bill_of_lading");
  } else {
    required.add("transport_document");
  }

  if (normalizedStatus === "delivered") required.add("proof_of_delivery");
  return required;
}

export function emptyChecklistItems(mode: string, status = "") {
  const defaults = defaultDocumentRequirements(mode, status);
  return documentCategories.map((category) => ({
    category,
    label: documentCategoryLabels[category],
    required: defaults.has(category),
    default_required: defaults.has(category),
    overridden: false,
    present: false,
    document_count: 0,
  })) satisfies DocumentChecklistItem[];
}
