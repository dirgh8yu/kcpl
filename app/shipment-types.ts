export const shipmentStatuses = [
  "booking_confirmed",
  "preparing",
  "in_transit",
  "customs_clearance",
  "out_for_delivery",
  "delivered",
  "exception",
] as const;

export type ShipmentStatus = (typeof shipmentStatuses)[number];

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  booking_confirmed: "Booking confirmed",
  preparing: "Preparing cargo",
  in_transit: "In transit",
  customs_clearance: "Customs clearance",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Attention required",
};

export type ShipmentEvent = {
  id: number;
  shipment_reference: string;
  title: string;
  location: string | null;
  details: string | null;
  event_time: string;
  created_at: string;
  author_name: string;
};

export type ShipmentDetail = {
  reference: string;
  quote_reference: string;
  created_at: string;
  updated_at: string;
  status: ShipmentStatus;
  eta: string | null;
  current_location: string | null;
  carrier: string | null;
  carrier_reference: string | null;
  customer_note: string | null;
  events: ShipmentEvent[];
};

export type ShipmentUpdateInput = {
  status: ShipmentStatus;
  eta: string;
  currentLocation: string;
  carrier: string;
  carrierReference: string;
  customerNote: string;
};

export type PublicShipmentEvent = Pick<ShipmentEvent, "id" | "title" | "location" | "details" | "event_time">;

export type PublicShipmentTracking = {
  reference: string;
  status: ShipmentStatus;
  created_at: string;
  updated_at: string;
  eta: string | null;
  current_location: string | null;
  carrier: string | null;
  carrier_reference: string | null;
  customer_note: string | null;
  origin: string;
  destination: string;
  mode: string;
  events: PublicShipmentEvent[];
};
