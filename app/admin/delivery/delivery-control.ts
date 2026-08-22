import type { KcplBranch } from "../crm/crm-data";

export const deliveryAttemptStatuses = [
  "scheduled",
  "out_for_delivery",
  "delivered",
  "failed",
  "refused",
] as const;
export type DeliveryAttemptStatus = (typeof deliveryAttemptStatuses)[number];

export const deliveryAttemptStatusLabels: Record<DeliveryAttemptStatus, string> = {
  scheduled: "Scheduled",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Failed attempt",
  refused: "Delivery refused",
};

export const podEvidenceKinds = ["photo", "signature", "document"] as const;
export type PodEvidenceKind = (typeof podEvidenceKinds)[number];

export const podReviewStatuses = ["received", "verified", "rejected"] as const;
export type PodReviewStatus = (typeof podReviewStatuses)[number];

export type DeliveryAttempt = {
  id: string;
  shipment_reference: string;
  attempt_number: number;
  status: DeliveryAttemptStatus;
  scheduled_for: string | null;
  event_time: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_relation: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_reference: string | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
  created_by_email: string | null;
  updated_at: string;
  updated_by_name: string | null;
  updated_by_email: string | null;
};

export type PodEvidence = {
  id: string;
  shipment_reference: string;
  attempt_id: string;
  kind: PodEvidenceKind;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  review_status: PodReviewStatus;
  customer_safe: boolean;
  captured_at: string;
  uploaded_at: string;
  uploaded_by_name: string | null;
  uploaded_by_email: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  reviewed_by_email: string | null;
  review_note: string | null;
};

export type DeliveryPodState = "not_started" | "delivery_active" | "delivery_failed" | "delivered_pod_pending" | "pod_verified";

export type DeliveryQueueRow = {
  reference: string;
  quote_reference: string;
  customer_id: string | null;
  customer_name: string;
  origin: string;
  destination: string;
  mode: string;
  primary_branch: KcplBranch;
  status: string;
  delivery_state: DeliveryPodState;
  attempt_count: number;
  last_attempt_status: DeliveryAttemptStatus | null;
  last_attempt_at: string | null;
  pod_status: "not_received" | "received" | "rejected" | "verified";
  pod_evidence_count: number;
  recipient_name: string | null;
  next_delivery_at: string | null;
  current_location: string | null;
  updated_at: string;
};

export type DeliverySummary = {
  ready: number;
  out_for_delivery: number;
  failed_or_refused: number;
  delivered_pod_pending: number;
  pod_verified: number;
};

export function deliveryAttemptTransitionAllowed(from: DeliveryAttemptStatus, to: DeliveryAttemptStatus) {
  if (from === to) return true;
  if (from === "scheduled") return ["out_for_delivery", "delivered", "failed", "refused"].includes(to);
  if (from === "out_for_delivery") return ["delivered", "failed", "refused"].includes(to);
  return false;
}

export function deliveryOutcomeValid(status: DeliveryAttemptStatus, values: { recipientName?: string; failureReason?: string; scheduledFor?: string }) {
  if (status === "scheduled") return Boolean(values.scheduledFor?.trim());
  if (status === "delivered") return (values.recipientName?.trim().length ?? 0) >= 2;
  if (status === "failed" || status === "refused") return (values.failureReason?.trim().length ?? 0) >= 6;
  return true;
}

export function podFileAccepted(contentType: string, sizeBytes: number) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  return allowed.has(contentType.toLowerCase()) && sizeBytes > 0 && sizeBytes <= 12 * 1024 * 1024;
}

export function deriveDeliveryState(input: {
  shipmentStatus: string;
  attemptStatus: DeliveryAttemptStatus | null;
  podStatus: string | null;
}): DeliveryPodState {
  if (input.podStatus === "verified") return "pod_verified";
  if (input.shipmentStatus === "delivered" || input.attemptStatus === "delivered") return "delivered_pod_pending";
  if (input.attemptStatus === "failed" || input.attemptStatus === "refused") return "delivery_failed";
  if (input.shipmentStatus === "out_for_delivery" || input.attemptStatus === "scheduled" || input.attemptStatus === "out_for_delivery") return "delivery_active";
  return "not_started";
}

export function summarizeDelivery(rows: DeliveryQueueRow[]): DeliverySummary {
  return {
    ready: rows.filter((row) => row.delivery_state === "not_started").length,
    out_for_delivery: rows.filter((row) => row.delivery_state === "delivery_active").length,
    failed_or_refused: rows.filter((row) => row.delivery_state === "delivery_failed").length,
    delivered_pod_pending: rows.filter((row) => row.delivery_state === "delivered_pod_pending").length,
    pod_verified: rows.filter((row) => row.delivery_state === "pod_verified").length,
  };
}
