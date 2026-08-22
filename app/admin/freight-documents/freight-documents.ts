import type { KcplBranch } from "../crm/crm-data";
import type { ShipmentDocumentType } from "../../shipment-document-types";

export const generatedFreightDocumentKinds = [
  "house_bill_of_lading",
  "house_air_waybill",
  "road_consignment_note",
  "shipping_instruction",
  "cargo_manifest",
  "pickup_order",
  "delivery_order",
] as const;
export type GeneratedFreightDocumentKind = (typeof generatedFreightDocumentKinds)[number];

export const generatedFreightDocumentLabels: Record<GeneratedFreightDocumentKind, string> = {
  house_bill_of_lading: "KCPL House Bill of Lading",
  house_air_waybill: "KCPL House Air Waybill / working AWB",
  road_consignment_note: "Road consignment note",
  shipping_instruction: "Shipping instruction",
  cargo_manifest: "Cargo manifest",
  pickup_order: "Pickup order",
  delivery_order: "Delivery order",
};

export const generatedDocumentTypeMap: Record<GeneratedFreightDocumentKind, ShipmentDocumentType> = {
  house_bill_of_lading: "bill_of_lading",
  house_air_waybill: "air_waybill",
  road_consignment_note: "road_consignment_note",
  shipping_instruction: "shipping_instruction",
  cargo_manifest: "cargo_manifest",
  pickup_order: "pickup_order",
  delivery_order: "delivery_order",
};

export type FreightDocumentSource = {
  reference: string;
  branch: KcplBranch;
  customer_id: string | null;
  customer_name: string;
  origin: string;
  destination: string;
  mode: string;
  booking_reference: string | null;
  carrier_name: string | null;
  transport_order_id: string | null;
  pieces: number;
  weight_kg: number;
  volume_cbm: number;
  container_count: number;
  equipment: string | null;
  pickup_date: string | null;
  delivery_date: string | null;
  cargo_description: string;
  updated_at: string;
};

export type FreightDocumentInput = {
  kind: GeneratedFreightDocumentKind;
  shipper: string;
  consignee: string;
  notifyParty: string;
  cargoDescription: string;
  marksAndNumbers: string;
  packageType: string;
  freightTerms: string;
  placeOfReceipt: string;
  placeOfDelivery: string;
  masterReference: string;
  houseReference: string;
  incoterm: string;
  specialInstructions: string;
  customerSafe: boolean;
};

export type GeneratedFreightDocumentRow = {
  document_id: string;
  shipment_reference: string;
  kind: GeneratedFreightDocumentKind;
  label: string;
  filename: string;
  document_type: ShipmentDocumentType;
  revision: number;
  review_status: string;
  customer_safe: boolean;
  sha256: string;
  generated_at: string;
  generated_by_name: string | null;
  superseded: boolean;
};

export type FreightDocumentQueueRow = FreightDocumentSource & {
  recommended_kinds: GeneratedFreightDocumentKind[];
  generated_documents: GeneratedFreightDocumentRow[];
  current_generated_count: number;
  missing_primary_carriage_document: boolean;
};

export function recommendedGeneratedDocumentKinds(mode: string): GeneratedFreightDocumentKind[] {
  const normalized = mode.trim().toLowerCase();
  const base: GeneratedFreightDocumentKind[] = ["shipping_instruction", "cargo_manifest", "pickup_order", "delivery_order"];
  if (normalized === "sea" || normalized === "ocean") return ["house_bill_of_lading", ...base];
  if (normalized === "air") return ["house_air_waybill", ...base];
  if (normalized === "road") return ["road_consignment_note", ...base];
  if (normalized === "multimodal") return ["house_bill_of_lading", "house_air_waybill", "road_consignment_note", ...base];
  return base;
}

export function freightDocumentKindAllowedForMode(kind: GeneratedFreightDocumentKind, mode: string) {
  const normalized = mode.trim().toLowerCase();
  if (kind === "house_bill_of_lading") return normalized === "sea" || normalized === "ocean" || normalized === "multimodal";
  if (kind === "house_air_waybill") return normalized === "air" || normalized === "multimodal";
  if (kind === "road_consignment_note") return normalized === "road" || normalized === "multimodal";
  return true;
}

export function primaryCarriageDocumentKind(mode: string): GeneratedFreightDocumentKind | null {
  const normalized = mode.trim().toLowerCase();
  if (normalized === "sea" || normalized === "ocean") return "house_bill_of_lading";
  if (normalized === "air") return "house_air_waybill";
  if (normalized === "road") return "road_consignment_note";
  return null;
}

function pdfLatinRepresentable(value: string) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return !/[^\x09\x0A\x0D\x20-\x7E]/.test(normalized);
}

export function validateFreightDocumentInput(input: FreightDocumentInput, source: FreightDocumentSource) {
  const issues: string[] = [];
  if (!generatedFreightDocumentKinds.includes(input.kind)) issues.push("Choose a supported freight document type.");
  if (!freightDocumentKindAllowedForMode(input.kind, source.mode)) issues.push("This document type does not match the shipment mode.");
  if (input.shipper.trim().length < 2) issues.push("Shipper details are required.");
  if (input.consignee.trim().length < 2) issues.push("Consignee details are required.");
  if (input.cargoDescription.trim().length < 2) issues.push("Cargo description is required.");
  if (!source.origin.trim() || !source.destination.trim()) issues.push("Origin and destination are required before document generation.");

  const renderFields: Array<[string, string]> = [
    ["Shipper", input.shipper], ["Consignee", input.consignee], ["Notify party", input.notifyParty],
    ["Cargo description", input.cargoDescription], ["Marks and numbers", input.marksAndNumbers], ["Package type", input.packageType],
    ["Freight terms", input.freightTerms], ["Place of receipt", input.placeOfReceipt || source.origin], ["Place of delivery", input.placeOfDelivery || source.destination],
    ["Master reference", input.masterReference], ["House reference", input.houseReference], ["Incoterm", input.incoterm], ["Special instructions", input.specialInstructions],
  ];
  const unsupported = renderFields.filter(([, value]) => value.trim() && !pdfLatinRepresentable(value)).map(([label]) => label);
  if (unsupported.length) issues.push(`${unsupported.join(", ")} contain script characters the current controlled PDF renderer cannot reproduce safely. Use a Latin-script/transliterated value for this revision rather than generating corrupted freight paperwork.`);
  return issues;
}

export function generatedReference(kind: GeneratedFreightDocumentKind, shipmentReference: string) {
  const stem = shipmentReference.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(-18) || "SHIPMENT";
  const prefix: Record<GeneratedFreightDocumentKind, string> = {
    house_bill_of_lading: "HBL",
    house_air_waybill: "HAWB",
    road_consignment_note: "RCN",
    shipping_instruction: "SI",
    cargo_manifest: "MAN",
    pickup_order: "PUO",
    delivery_order: "DO",
  };
  return `KCPL-${prefix[kind]}-${stem}`;
}

export function generatedDocumentDisclaimer(kind: GeneratedFreightDocumentKind) {
  if (kind === "house_bill_of_lading") return "KCPL-issued house/working carriage document. It is not a shipping-line master bill of lading unless separately validated and issued by the carrier.";
  if (kind === "house_air_waybill") return "KCPL house/working air carriage document. It is not an airline master air waybill unless separately validated and issued by the airline or authorised agent.";
  if (kind === "road_consignment_note") return "KCPL working road consignment record. Carrier acknowledgement and applicable legal requirements must be verified before external reliance.";
  return "KCPL operational document generated from the Digital Job File. Staff must verify source data before external use.";
}
