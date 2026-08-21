import type { CrmCurrency, KcplBranch } from "../crm/crm-data";
import type { JobCostCategory } from "../job-file";

export const payablesImportRecordTypes = ["bill", "opening_balance"] as const;
export type PayablesImportRecordType = (typeof payablesImportRecordTypes)[number];

export const payablesImportStatuses = ["ready", "duplicate", "invalid"] as const;
export type PayablesImportStatus = (typeof payablesImportStatuses)[number];

export const payablesImportHeaders = [
  "record_type",
  "supplier_id",
  "supplier_name",
  "shipment_reference",
  "branch",
  "supplier_bill_reference",
  "bill_date",
  "due_date",
  "as_of_date",
  "currency",
  "bill_total",
  "amount_paid",
  "balance_due",
  "category",
  "description",
  "notes",
] as const;

export type PayablesImportPreviewRow = {
  row_number: number;
  status: PayablesImportStatus;
  record_type: PayablesImportRecordType | null;
  supplier_id: string | null;
  supplier_name: string;
  shipment_reference: string | null;
  branch: KcplBranch | null;
  supplier_bill_reference: string | null;
  currency: CrmCurrency | null;
  category: JobCostCategory | null;
  bill_date: string | null;
  due_date: string | null;
  as_of_date: string | null;
  bill_total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  issues: string[];
  duplicate_matches: string[];
};

export type PayablesImportPreview = {
  filename: string;
  total: number;
  ready: number;
  duplicates: number;
  invalid: number;
  bill_rows: number;
  opening_balance_rows: number;
  rows: PayablesImportPreviewRow[];
};

export type PayablesImportResult = {
  batch_id: string;
  filename: string;
  total: number;
  imported: number;
  bill_rows_imported: number;
  opening_balance_rows_imported: number;
  duplicates: number;
  invalid: number;
  payable_references: string[];
};
