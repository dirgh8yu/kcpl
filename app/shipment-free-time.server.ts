import { firebaseAdminDb, firebaseRuntimeConfigured } from "./firebase-admin.server";
import { freeTimeStatus, shipmentFreeTimeFromRecord, type FreeTimeStatus, type ShipmentFreeTime } from "./shipment-free-time";

/**
 * Read the free-time block off a shipment.
 *
 * Read-only, and kept out of the pages that render it so a Job File or a route
 * does not become a persistence surface just to show a countdown. Callers that
 * need to *write* free time go through the namespaced admin route, which
 * touches free-time fields and nothing canonical.
 */
export async function readShipmentFreeTime(reference: string, today = new Date().toISOString().slice(0, 10)): Promise<
  { freeTime: ShipmentFreeTime; status: FreeTimeStatus } | null
> {
  if (!firebaseRuntimeConfigured() || !reference.trim()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).get();
    if (!snapshot.exists) return null;
    const freeTime = shipmentFreeTimeFromRecord(snapshot.data() as Record<string, unknown>);
    return { freeTime, status: freeTimeStatus(freeTime, today) };
  } catch (error) {
    console.error("KCPL free-time read failed", error);
    return null;
  }
}
