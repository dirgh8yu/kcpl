export const shipmentDocumentTypes = [
  "air_waybill",
  "bill_of_lading",
  "road_consignment_note",
  "shipping_instruction",
  "cargo_manifest",
  "pickup_order",
  "commercial_invoice",
  "packing_list",
  "customs_document",
  "certificate_of_origin",
  "import_permit",
  "export_permit",
  "dangerous_goods_declaration",
  "insurance_certificate",
  "delivery_order",
  "proof_of_delivery",
  "other",
] as const;

export type ShipmentDocumentType = (typeof shipmentDocumentTypes)[number];

export const shipmentDocumentTypeLabels: Record<ShipmentDocumentType, string> = {
  air_waybill: "Air waybill (AWB)",
  bill_of_lading: "Bill of lading (BL)",
  road_consignment_note: "Road consignment note",
  shipping_instruction: "Shipping instruction",
  cargo_manifest: "Cargo manifest",
  pickup_order: "Pickup order",
  commercial_invoice: "Commercial invoice",
  packing_list: "Packing list",
  customs_document: "Customs document",
  certificate_of_origin: "Certificate of origin",
  import_permit: "Import permit / licence",
  export_permit: "Export permit / licence",
  dangerous_goods_declaration: "Dangerous goods declaration",
  insurance_certificate: "Cargo insurance certificate",
  delivery_order: "Delivery order",
  proof_of_delivery: "Proof of delivery (POD)",
  other: "Other document",
};

export const shipmentDocumentReviewStatuses = ["received", "under_review", "verified", "rejected", "superseded", "deleted"] as const;
export type ShipmentDocumentReviewStatus = (typeof shipmentDocumentReviewStatuses)[number];
export type ShipmentDocumentEffectiveStatus = ShipmentDocumentReviewStatus | "expired";

export const shipmentDocumentReviewStatusLabels: Record<ShipmentDocumentReviewStatus, string> = {
  received: "Received",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
  superseded: "Superseded",
  deleted: "Deleted",
};

export type ShipmentDocument = {
  id: number;
  shipment_reference: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  document_type: ShipmentDocumentType;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_email?: string | null;
  review_status?: ShipmentDocumentReviewStatus;
  customer_safe?: boolean;
  review_note?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reviewed_by_email?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  verified_by_email?: string | null;
  expires_on?: string | null;
  supersedes_document_id?: number | null;
  superseded_by_document_id?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_email?: string | null;
  sha256?: string | null;
};
