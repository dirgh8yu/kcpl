import type { CrmCurrency, KcplBranch } from "../crm/crm-data";

export const receivablesImportHeaders = [
  "record_type",
  "customer_id",
  "customer_name",
  "shipment_reference",
  "external_invoice_number",
  "issue_date",
  "due_date",
  "as_of_date",
  "currency",
  "invoice_total",
  "amount_paid",
  "balance_due",
  "description",
  "notes",
] as const;

export type ReceivablesImportRecordType = "invoice" | "opening_balance";
export type ReceivablesImportStatus = "ready" | "duplicate" | "invalid";

export type ReceivablesImportPreviewRow = {
  row_number: number;
  status: ReceivablesImportStatus;
  record_type: ReceivablesImportRecordType | null;
  customer_id: string | null;
  customer_name: string;
  shipment_reference: string | null;
  external_invoice_number: string | null;
  branch: KcplBranch | null;
  currency: CrmCurrency | null;
  issue_date: string | null;
  due_date: string | null;
  as_of_date: string | null;
  invoice_total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  issues: string[];
  duplicate_matches: string[];
};

export type ReceivablesImportPreview = {
  filename: string;
  total: number;
  ready: number;
  duplicates: number;
  invalid: number;
  invoice_rows: number;
  opening_balance_rows: number;
  rows: ReceivablesImportPreviewRow[];
};

export type ReceivablesImportResult = {
  batch_id: string;
  filename: string;
  total: number;
  imported: number;
  invoice_rows_imported: number;
  opening_balance_rows_imported: number;
  duplicates: number;
  invalid: number;
  receivable_references: string[];
};
