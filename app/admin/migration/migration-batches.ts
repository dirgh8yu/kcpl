export type MigrationBatchStatus = "running" | "completed" | "partial_failure" | "interrupted" | "unknown";

export type MigrationCreatedRecord = {
  kind: "customer" | "shipment" | "receivable" | "payable";
  id: string;
  href: string;
};

export type MigrationBatchSummary = {
  id: string;
  stage_label: string;
  type_label: string;
  type: string;
  phase: string | null;
  status: MigrationBatchStatus;
  stored_status: string;
  source_filename: string | null;
  total_rows: number;
  ready_rows: number;
  duplicate_rows: number;
  invalid_rows: number;
  imported_count: number;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  completed_at: string | null;
  error: string | null;
  rollback_status: string | null;
  rollback_recovery_id: string | null;
  rollback_completed_at: string | null;
  rollback_error: string | null;
  rollback_reversed_record_keys: string[];
  created_records: MigrationCreatedRecord[];
  detail_metrics: Array<{ label: string; value: number }>;
};

export type MigrationBatchDashboard = {
  generated_at: string;
  batches: MigrationBatchSummary[];
  total_batches: number;
  completed_batches: number;
  partial_failure_batches: number;
  interrupted_batches: number;
  imported_records: number;
};
