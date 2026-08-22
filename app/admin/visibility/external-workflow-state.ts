import type { PickupAppointmentStatus } from "../pickups/pickup-appointments";
import type { ShipmentStatus } from "../../shipment-types";
import type { TrackingMilestone, TrackingSource } from "./tracking-visibility";

export const externalPromotionDecisions = ["promote", "observe_only", "blocked", "no_change"] as const;
export type ExternalPromotionDecision = (typeof externalPromotionDecisions)[number];

export type ExternalPromotionResult = {
  decision: ExternalPromotionDecision;
  targetStatus: ShipmentStatus | null;
  reason: string;
};

export type ExternalPromotionInput = {
  canonicalStatus: ShipmentStatus;
  observedMilestone: TrackingMilestone;
  source: TrackingSource;
  direction?: string | null;
  customsClearanceStatus?: string | null;
  podStatus?: string | null;
  pickupStatus?: PickupAppointmentStatus | string | null;
  hasBlockingException?: boolean;
  isLateObservation?: boolean;
};

const canonicalRank: Record<ShipmentStatus, number> = {
  booking_confirmed: 0,
  preparing: 1,
  in_transit: 2,
  customs_clearance: 3,
  out_for_delivery: 4,
  delivered: 5,
  exception: -1,
};

export function externalMilestoneCandidateStatus(milestone: TrackingMilestone): ShipmentStatus | null {
  if (milestone === "pickup_scheduled") return "preparing";
  if (["picked_up", "origin_terminal", "departed", "transshipment", "arrived_destination"].includes(milestone)) return "in_transit";
  if (milestone === "export_customs" || milestone === "import_customs") return "customs_clearance";
  if (milestone === "out_for_delivery" || milestone === "delivery_attempted") return "out_for_delivery";
  if (milestone === "delivered") return "delivered";
  return null;
}

export function externalObservationIsMachine(source: TrackingSource) {
  return source !== "manual";
}

export function customsReleaseRequiredForDirection(direction: string | null | undefined) {
  return ["import", "export", "cross_trade"].includes((direction ?? "").trim().toLowerCase());
}

export function evaluateExternalPromotion(input: ExternalPromotionInput): ExternalPromotionResult {
  const targetStatus = externalMilestoneCandidateStatus(input.observedMilestone);

  if (!externalObservationIsMachine(input.source)) {
    return { decision: "observe_only", targetStatus, reason: "manual_tracking_is_observation_only" };
  }
  if (!targetStatus) {
    return { decision: "observe_only", targetStatus: null, reason: input.observedMilestone === "exception" || input.observedMilestone === "delivery_refused" ? "external_exception_requires_kcpl_resolution" : "milestone_has_no_canonical_transition" };
  }
  if (input.canonicalStatus === "delivered") {
    return { decision: "no_change", targetStatus: "delivered", reason: "canonical_delivered_is_terminal" };
  }
  if (input.canonicalStatus === "exception") {
    return { decision: "blocked", targetStatus, reason: "canonical_exception_requires_kcpl_resolution" };
  }
  if (input.isLateObservation) {
    return { decision: "observe_only", targetStatus, reason: "late_external_observation" };
  }
  if ((input.observedMilestone === "picked_up" || targetStatus === "in_transit") && input.pickupStatus === "cancelled") {
    return { decision: "blocked", targetStatus, reason: "pickup_cancelled" };
  }
  if (input.observedMilestone === "picked_up" && input.pickupStatus && input.pickupStatus !== "picked_up") {
    return { decision: "blocked", targetStatus, reason: "pickup_reconciliation_required" };
  }
  if (input.hasBlockingException) {
    return { decision: "blocked", targetStatus, reason: "blocking_operational_exception" };
  }

  const requiresRelease = customsReleaseRequiredForDirection(input.direction);
  if ((targetStatus === "out_for_delivery" || targetStatus === "delivered") && requiresRelease && input.customsClearanceStatus !== "released") {
    return { decision: "blocked", targetStatus, reason: "customs_not_released" };
  }
  if (targetStatus === "delivered" && input.podStatus !== "verified") {
    return { decision: "blocked", targetStatus, reason: "pod_not_verified" };
  }

  if (canonicalRank[targetStatus] <= canonicalRank[input.canonicalStatus]) {
    return { decision: "no_change", targetStatus, reason: "canonical_state_not_regressed" };
  }
  return { decision: "promote", targetStatus, reason: "kcpl_external_promotion_policy_satisfied" };
}

export function externalObservationIsNewer(currentObservedAt: string | null | undefined, nextObservedAt: string) {
  const next = Date.parse(nextObservedAt);
  if (!Number.isFinite(next)) return false;
  if (!currentObservedAt) return true;
  const current = Date.parse(currentObservedAt);
  return !Number.isFinite(current) || next >= current;
}
