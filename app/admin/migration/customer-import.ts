import type { KcplBranch } from "../crm/crm-data";

export const customerImportHeaders = [
  "display_name",
  "primary_branch",
  "legal_name",
  "trading_name",
  "primary_email",
  "primary_phone",
  "tax_id",
  "country",
  "billing_email",
  "website",
  "industry",
  "entity_kind",
  "account_status",
  "lead_stage",
  "lead_source",
  "preferred_currency",
  "tags",
  "internal_summary",
] as const;

export type CustomerImportStatus = "ready" | "duplicate" | "invalid";

export type CustomerImportPreviewRow = {
  row_number: number;
  status: CustomerImportStatus;
  display_name: string;
  primary_branch: KcplBranch | null;
  primary_email: string;
  primary_phone: string;
  tax_id: string;
  issues: string[];
  duplicate_matches: string[];
};

export type CustomerImportPreview = {
  filename: string;
  total: number;
  ready: number;
  duplicates: number;
  invalid: number;
  rows: CustomerImportPreviewRow[];
};

export type CustomerImportResult = {
  batch_id: string;
  filename: string;
  total: number;
  imported: number;
  duplicates: number;
  invalid: number;
  customer_ids: string[];
};
