import type { ShipmentStatus } from "./shipment-types.ts";

export type ShipmentStatusTone = "neutral" | "info" | "warning" | "success" | "danger";

/**
 * One colour per shipment status, for staff and customers alike: a shipment
 * that is green in the Shipments register is green on the customer's portal
 * too. Moving is green, customs is amber, out for delivery is blue, a problem
 * is red, and everything else (booked, preparing, delivered) is quiet.
 */
export function shipmentStatusTone(status: ShipmentStatus | string): ShipmentStatusTone {
  if (status === "exception") return "danger";
  if (status === "customs_clearance") return "warning";
  if (status === "out_for_delivery") return "info";
  if (status === "in_transit") return "success";
  return "neutral";
}
