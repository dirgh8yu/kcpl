import type { KcplBranch } from "../../crm/crm-data";

export const archiveEntityTypes = ["general", "customer", "shipment", "partner", "receivable", "payable", "migration_batch"] as const;
export type ArchiveEntityType = (typeof archiveEntityTypes)[number];

export const archiveEntityTypeLabels: Record<ArchiveEntityType, string> = {
  general: "General archive",
  customer: "Customer",
  shipment: "Shipment / Job File",
  partner: "Partner / Supplier",
  receivable: "Receivable",
  payable: "Payable",
  migration_batch: "Migration batch",
};

export const archiveCategories = ["shipment_file", "customs", "finance", "customer", "supplier", "correspondence", "legal", "other"] as const;
export type ArchiveCategory = (typeof archiveCategories)[number];

export const archiveCategoryLabels: Record<ArchiveCategory, string> = {
  shipment_file: "Shipment file",
  customs: "Customs",
  finance: "Finance",
  customer: "Customer records",
  supplier: "Supplier records",
  correspondence: "Correspondence",
  legal: "Legal / compliance",
  other: "Other",
};

export type PaperArchiveRecord = {
  id: string;
  title: string;
  category: ArchiveCategory;
  document_date: string | null;
  branch: KcplBranch;
  physical_reference: string | null;
  notes: string | null;
  entity_type: ArchiveEntityType;
  entity_reference: string | null;
  entity_label: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string;
  uploaded_by_name: string;
  uploaded_by_email: string;
};

export type PaperArchiveDashboard = {
  records: PaperArchiveRecord[];
  storage_available: boolean;
  total: number;
};

export function archiveEntityHref(record: Pick<PaperArchiveRecord, "entity_type" | "entity_reference">) {
  if (!record.entity_reference) return null;
  const reference = encodeURIComponent(record.entity_reference);
  if (record.entity_type === "customer") return `/admin/crm/${reference}`;
  if (record.entity_type === "shipment") return `/admin/jobs/${reference}`;
  if (record.entity_type === "partner") return `/admin/partners/${reference}`;
  if (record.entity_type === "receivable") return `/admin/finance/invoices/${reference}`;
  if (record.entity_type === "payable") return `/admin/payables/bills/${reference}`;
  if (record.entity_type === "migration_batch") return `/admin/migration/batches/${reference}`;
  return null;
}
