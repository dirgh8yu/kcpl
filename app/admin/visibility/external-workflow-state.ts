import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types.ts";
import type { PickupAppointmentStatus } from "../pickups/pickup-appointments";
import type { TrackingMilestone, TrackingSource } from "./tracking-visibility";

export const externalPromotionDecisions = ["promote", "observe_only", "blocked", "no_change"] as const;
export type ExternalPromotionDecision = (typeof externalPromotionDecisions)[number];

export type ExternalPromotionResult = {
  decision: ExternalPromotionDecision;
  targetStatus: ShipmentStatus | null;
  reason: string;
};

export type ExternalPromotionInput = {
  canonicalStatus: ShipmentStatus | null;
  observedMilestone: TrackingMilestone;
  source: TrackingSource;
  direction?: string | null;
  customsClearanceStatus?: string | null;
  podStatus?: string | null;
  pickupStatus?: PickupAppointmentStatus | string | null;
  deliveryWorkflowComplete?: boolean;
  hasBlockingException?: boolean;
  isLateObservation?: boolean;
};

export type ExternalDerivedExceptionPlan = {
  kind: "delivery_refused" | "carrier_exception" | "eta_delay";
  triggerKey: string;
  category: "delay" | "delivery_refusal" | "carrier";
  severity: "medium" | "high";
  title: string;
  detail: string;
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

export function canonicalShipmentStatus(value: unknown): ShipmentStatus | null {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : null;
}

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
  if (!externalObservationIsMachine(input.source)) return { decision: "observe_only", targetStatus, reason: "manual_tracking_is_observation_only" };
  if (!input.canonicalStatus) return { decision: "blocked", targetStatus, reason: "invalid_canonical_status" };
  if (!targetStatus) return { decision: "observe_only", targetStatus: null, reason: input.observedMilestone === "exception" || input.observedMilestone === "delivery_refused" ? "external_exception_requires_kcpl_resolution" : "milestone_has_no_canonical_transition" };
  if (input.canonicalStatus === "delivered") return { decision: "no_change", targetStatus: "delivered", reason: "canonical_delivered_is_terminal" };
  if (input.canonicalStatus === "exception") return { decision: "blocked", targetStatus, reason: "canonical_exception_requires_kcpl_resolution" };
  if (input.isLateObservation) return { decision: "observe_only", targetStatus, reason: "late_external_observation" };
  if (input.observedMilestone === "picked_up" && input.pickupStatus === "cancelled") return { decision: "blocked", targetStatus, reason: "pickup_cancelled" };
  if (input.observedMilestone === "picked_up" && input.pickupStatus !== "picked_up") return { decision: "blocked", targetStatus, reason: "pickup_reconciliation_required" };
  if (input.hasBlockingException) return { decision: "blocked", targetStatus, reason: "blocking_operational_exception" };

  const requiresRelease = customsReleaseRequiredForDirection(input.direction);
  if ((targetStatus === "out_for_delivery" || targetStatus === "delivered") && requiresRelease && input.customsClearanceStatus !== "released") return { decision: "blocked", targetStatus, reason: "customs_not_released" };
  if (targetStatus === "delivered" && input.podStatus !== "verified") return { decision: "blocked", targetStatus, reason: "pod_not_verified" };
  if (targetStatus === "delivered" && input.deliveryWorkflowComplete !== true) return { decision: "blocked", targetStatus, reason: "delivery_verification_required" };
  if (canonicalRank[targetStatus] <= canonicalRank[input.canonicalStatus]) return { decision: "no_change", targetStatus, reason: "canonical_state_not_regressed" };
  return { decision: "promote", targetStatus, reason: "kcpl_external_promotion_policy_satisfied" };
}

export function externalObservationIsNewer(currentObservedAt: string | null | undefined, nextObservedAt: string) {
  const next = Date.parse(nextObservedAt);
  if (!Number.isFinite(next)) return false;
  if (!currentObservedAt) return true;
  const current = Date.parse(currentObservedAt);
  return !Number.isFinite(current) || next >= current;
}

export function externalObservationIsLate(
  currentTrackingAt: string | null | undefined,
  currentExternalAt: string | null | undefined,
  nextObservedAt: string,
) {
  const next = Date.parse(nextObservedAt);
  if (!Number.isFinite(next)) return false;
  return [currentTrackingAt, currentExternalAt].some((value) => {
    if (!value) return false;
    const current = Date.parse(value);
    return Number.isFinite(current) && next < current;
  });
}

function etaDelayHours(previousEta: string | null | undefined, nextEta: string | null | undefined) {
  if (!previousEta || !nextEta) return null;
  const previous = Date.parse(previousEta);
  const next = Date.parse(nextEta);
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  return (next - previous) / 3_600_000;
}

export function deriveExternalObservationExceptions(input: {
  fingerprint: string;
  milestone: TrackingMilestone;
  rawStatus?: string | null;
  details?: string | null;
  previousEta?: string | null;
  nextEta?: string | null;
  isLateObservation?: boolean;
}): ExternalDerivedExceptionPlan[] {
  if (input.isLateObservation) return [];
  const plans: ExternalDerivedExceptionPlan[] = [];
  if (input.milestone === "delivery_refused") {
    plans.push({
      kind: "delivery_refused",
      triggerKey: `delivery-refused:${input.fingerprint}`,
      category: "delivery_refusal",
      severity: "high",
      title: "Delivery refused by consignee",
      detail: input.details || input.rawStatus || "Carrier tracking reported a refused delivery.",
    });
  }
  if (input.milestone === "exception") {
    plans.push({
      kind: "carrier_exception",
      triggerKey: `carrier-exception:${input.fingerprint}`,
      category: "carrier",
      severity: "high",
      title: "Carrier tracking exception",
      detail: input.details || input.rawStatus || "Carrier tracking reported an operational exception.",
    });
  }
  const delay = etaDelayHours(input.previousEta, input.nextEta);
  if (delay !== null && delay >= 24) {
    plans.push({
      kind: "eta_delay",
      triggerKey: `eta-delay:${input.fingerprint}`,
      category: "delay",
      severity: "medium",
      title: `ETA slipped by ${Math.round(delay)} hours`,
      detail: `Tracking moved ETA from ${input.previousEta} to ${input.nextEta}.`,
    });
  }
  return plans;
}
