import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types.ts";

export const canonicalDeliveryBlockerCodes = [
  "invalid_canonical_status",
  "invalid_primary_branch",
  "canonical_transition_invalid",
  "customer_link_required",
  "delivery_attempt_required",
  "pod_not_verified",
  "customs_steps_incomplete",
  "customs_not_released",
  "required_documents_incomplete",
  "blocking_operational_exception",
  "job_closed",
] as const;

export type CanonicalDeliveryBlockerCode = (typeof canonicalDeliveryBlockerCodes)[number];
export type CanonicalDeliveryDecision = "complete" | "blocked" | "already_complete" | "invalid_state";

export type CanonicalDeliveryCompletionInput = {
  canonicalStatus: ShipmentStatus | null;
  primaryBranchValid: boolean;
  customerLinked: boolean;
  jobClosed: boolean;
  deliveryAttemptExists: boolean;
  deliveryAttemptStatus: string | null;
  deliveryAttemptMatchesPod: boolean;
  podStatus: string | null;
  podManifestVerified: boolean;
  requiredDocumentsReady: boolean;
  customsReleaseRequired: boolean;
  customsChecklistReady: boolean;
  customsClearanceStatus: string | null;
  hasBlockingException: boolean;
};

export type CanonicalDeliveryCompletionResult = {
  decision: CanonicalDeliveryDecision;
  blockers: CanonicalDeliveryBlockerCode[];
  reason: CanonicalDeliveryBlockerCode | "canonical_delivery_authorized" | "already_delivered";
};

export const canonicalDeliveryBlockerMessages: Record<CanonicalDeliveryBlockerCode, string> = {
  invalid_canonical_status: "Shipment canonical status is invalid.",
  invalid_primary_branch: "Shipment primary branch is missing or invalid.",
  canonical_transition_invalid: "Shipment must be Out for delivery before canonical Delivered can be recorded.",
  customer_link_required: "A valid CRM customer link is required before canonical delivery completion.",
  delivery_attempt_required: "A current KCPL Delivery Control attempt must record physical delivery first.",
  pod_not_verified: "KCPL POD verification is required before canonical delivery completion.",
  customs_steps_incomplete: "Required Customs checklist steps must be complete before canonical delivery completion.",
  customs_not_released: "Explicit KCPL Customs release is required before canonical delivery completion.",
  required_documents_incomplete: "Required operational documents must be verified and unexpired before canonical delivery completion.",
  blocking_operational_exception: "Resolve active high or critical operational exceptions before canonical delivery completion.",
  job_closed: "The Digital Job File is closed. Reopen it before canonical delivery completion.",
};

export function canonicalDeliveryStatus(value: unknown): ShipmentStatus | null {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : null;
}

export function evaluateCanonicalDeliveryCompletion(input: CanonicalDeliveryCompletionInput): CanonicalDeliveryCompletionResult {
  if (!input.canonicalStatus) {
    return { decision: "invalid_state", blockers: ["invalid_canonical_status"], reason: "invalid_canonical_status" };
  }
  if (input.canonicalStatus === "delivered") {
    return { decision: "already_complete", blockers: [], reason: "already_delivered" };
  }
  if (!input.primaryBranchValid) {
    return { decision: "invalid_state", blockers: ["invalid_primary_branch"], reason: "invalid_primary_branch" };
  }

  const blockers: CanonicalDeliveryBlockerCode[] = [];
  if (input.canonicalStatus !== "out_for_delivery") blockers.push("canonical_transition_invalid");
  if (!input.customerLinked) blockers.push("customer_link_required");
  if (input.jobClosed) blockers.push("job_closed");
  if (!input.deliveryAttemptExists || input.deliveryAttemptStatus !== "delivered") blockers.push("delivery_attempt_required");
  if (input.podStatus !== "verified" || !input.podManifestVerified || !input.deliveryAttemptMatchesPod) blockers.push("pod_not_verified");
  if (!input.requiredDocumentsReady) blockers.push("required_documents_incomplete");
  if (!input.customsChecklistReady) blockers.push("customs_steps_incomplete");
  if (input.customsReleaseRequired && input.customsClearanceStatus !== "released") blockers.push("customs_not_released");
  if (input.hasBlockingException) blockers.push("blocking_operational_exception");

  if (blockers.length) return { decision: "blocked", blockers, reason: blockers[0] };
  return { decision: "complete", blockers: [], reason: "canonical_delivery_authorized" };
}
