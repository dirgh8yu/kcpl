export const documentCategories = [
  "commercial_invoice",
  "packing_list",
  "bill_of_lading",
  "air_waybill",
  "customs_declaration",
  "certificate_of_origin",
  "insurance",
  "delivery_order",
  "proof_of_delivery",
  "transport_document",
  "receipt",
  "correspondence",
  "other",
] as const;

export type KcplDocumentCategory = (typeof documentCategories)[number];

export const documentCategoryLabels: Record<KcplDocumentCategory, string> = {
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  bill_of_lading: "Bill of Lading",
  air_waybill: "Air Waybill",
  customs_declaration: "Customs Declaration",
  certificate_of_origin: "Certificate of Origin",
  insurance: "Insurance",
  delivery_order: "Delivery Order",
  proof_of_delivery: "Proof of Delivery",
  transport_document: "Transport Document",
  receipt: "Receipt",
  correspondence: "Correspondence",
  other: "Other",
};

export type VaultDocument = {
  id: string;
  file_name: string;
  category: KcplDocumentCategory;
  content_type: string;
  size_bytes: number;
  shipment_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  branch: string;
  notes: string | null;
  uploaded_at: string;
  uploaded_by_name: string;
  uploaded_by_email: string;
  status: "current" | "deleted";
  deleted_at: string | null;
  deleted_by: string | null;
};

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
