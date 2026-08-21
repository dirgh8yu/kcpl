export const shipmentDocumentTypes = [
  "air_waybill",
  "bill_of_lading",
  "road_consignment_note",
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

export type ShipmentDocument = {
  id: number;
  shipment_reference: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  document_type: ShipmentDocumentType;
  uploaded_at: string;
  uploaded_by: string;
};
