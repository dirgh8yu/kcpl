import type { KcplBranch } from "../crm/crm-data";
import type { ShipmentStatus } from "../../shipment-types";

export const shipmentImportHeaders = [
  "shipment_reference",
  "record_class",
  "customer_id",
  "customer_name",
  "primary_branch",
  "handling_branches",
  "origin",
  "destination",
  "mode",
  "status",
  "shipment_date",
  "delivered_date",
  "eta",
  "current_location",
  "carrier",
  "carrier_reference",
  "cargo_type",
  "owner_email",
  "owner_name",
  "legacy_quote_reference",
  "legacy_job_reference",
  "internal_notes",
] as const;

export type ShipmentImportRecordClass = "active" | "historical";
export type ShipmentImportStatus = "ready" | "duplicate" | "invalid";

export type ShipmentImportPreviewRow = {
  row_number: number;
  status: ShipmentImportStatus;
  shipment_reference: string;
  record_class: ShipmentImportRecordClass | null;
  customer_id: string | null;
  customer_name: string;
  primary_branch: KcplBranch | null;
  origin: string;
  destination: string;
  mode: string;
  shipment_status: ShipmentStatus | null;
  shipment_date: string;
  delivered_date: string;
  eta: string;
  carrier_reference: string;
  owner: string;
  issues: string[];
  duplicate_matches: string[];
};

export type ShipmentImportPreview = {
  filename: string;
  total: number;
  ready: number;
  duplicates: number;
  invalid: number;
  active: number;
  historical: number;
  rows: ShipmentImportPreviewRow[];
};

export type ShipmentImportResult = {
  batch_id: string;
  filename: string;
  total: number;
  imported: number;
  active_imported: number;
  historical_imported: number;
  duplicates: number;
  invalid: number;
  shipment_references: string[];
};
