export type RecoveryRecordKind = "customer" | "shipment" | "receivable" | "payable";
export type RecoveryRecordStatus = "eligible" | "blocked" | "already_reversed" | "missing";

export type RecoveryRecordPlan = {
  key: string;
  kind: RecoveryRecordKind;
  id: string;
  href: string;
  status: RecoveryRecordStatus;
  reasons: string[];
  archive_relinks: number;
  state_token: string;
};

export type MigrationRecoveryPlan = {
  plan_id: string;
  plan_hash: string;
  batch_id: string;
  batch_type: string;
  batch_status: string;
  rollback_status: string | null;
  generated_at: string;
  expires_at: string;
  records: RecoveryRecordPlan[];
  eligible_count: number;
  blocked_count: number;
  already_reversed_count: number;
  missing_count: number;
  archive_relinks: number;
  warnings: string[];
  can_execute: boolean;
  confirmation_text: string;
};

export type MigrationRecoveryResult = {
  recovery_id: string;
  batch_id: string;
  status: "completed" | "partial_failure";
  reversed_count: number;
  already_reversed_count: number;
  archive_relinks: number;
  completed_record_keys: string[];
  error: string | null;
  completed_at: string;
};
