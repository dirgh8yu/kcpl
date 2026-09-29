import { shipmentStatuses } from "../shipment-types.ts";

/** Every status that is still work in progress. */
export const openShipmentStatuses = shipmentStatuses.filter((status) => status !== "delivered");
/** How many delivered jobs the operational screens keep in view, newest first. */
export const RECENT_DELIVERED_WINDOW = 500;
