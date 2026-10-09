import { firebaseAdminDb, firebaseRuntimeConfigured } from "./firebase-admin.server";
import { storedDutyEstimate } from "./shipment-duty-estimate";

/** The duty estimate saved on a shipment, or null. Read-only. */
export async function readShipmentDutyEstimate(reference: string) {
  if (!firebaseRuntimeConfigured() || !reference.trim()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).get();
    return snapshot.exists ? storedDutyEstimate(snapshot.get("duty_estimate")) : null;
  } catch (error) {
    console.error("KCPL duty estimate read failed", error);
    return null;
  }
}
