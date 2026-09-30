import type { PortalTextKey } from "./portal-i18n.ts";

/*
 * Where a shipment is on its way, in the six statuses KCPL moves it through.
 * Each step is a status, so the step a customer sees lit is the status they
 * read in emails and in the shipment list.
 *
 * An exception claims no step. The record keeps only the current status, so
 * a marker at "In transit" or "Customs" would tell the customer something KCPL
 * does not know; the page says what is wrong instead.
 */
export const portalTrackSteps = [
  "booking_confirmed",
  "preparing",
  "in_transit",
  "customs_clearance",
  "out_for_delivery",
  "delivered",
] as const;

export type PortalTrackStep = (typeof portalTrackSteps)[number];

export const portalTrackStepKeys: Record<PortalTrackStep, PortalTextKey> = {
  booking_confirmed: "track.booking_confirmed",
  preparing: "track.preparing",
  in_transit: "track.in_transit",
  customs_clearance: "track.customs_clearance",
  out_for_delivery: "track.out_for_delivery",
  delivered: "track.delivered",
};

/** The step a status stands at, or -1 for one that stands at none: an
 *  exception, or a status this build does not know. */
export function portalTrackPosition(status: string) {
  return portalTrackSteps.indexOf(status as PortalTrackStep);
}

export type PortalTrackState = "done" | "current" | "next";

/** Steps behind the shipment are done and steps ahead are next. Delivered is
 *  the last step and is done, not in progress. */
export function portalTrackState(index: number, position: number): PortalTrackState {
  if (index < position) return "done";
  if (index > position) return "next";
  return position === portalTrackSteps.length - 1 ? "done" : "current";
}
