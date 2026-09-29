import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { customsClearanceFromShipment } from "../../customs/customs-clearance.server";
import type { CustomsClearanceRecord } from "../../customs/customs-clearance";
import { appointmentId } from "../../pickups/pickup-appointments.server";
import { pickupAppointmentStatuses, type PickupAppointmentStatus } from "../../pickups/pickup-appointments";
import { qaMockDataEnabled } from "../../qa-fixtures";

export type JobStepContext = {
  clearance: CustomsClearanceRecord | null;
  pickupStatus: PickupAppointmentStatus | null;
};

/** The two facts the Job File checklist needs beyond workflow readiness: the
 * customs clearance record (so release is recorded in place) and the pickup
 * appointment. Branch access is already checked by the page. */
export async function getJobStepContext(reference: string): Promise<JobStepContext> {
  if (qaMockDataEnabled() || !firebaseRuntimeConfigured()) return { clearance: null, pickupStatus: null };
  const db = firebaseAdminDb();
  const id = reference.trim().toUpperCase();
  const [shipment, pickup] = await Promise.all([
    db.collection("shipments").doc(id).get(),
    db.collection("pickup_appointments").doc(appointmentId(id)).get(),
  ]);
  const status = pickup.exists ? pickup.get("status") : null;
  return {
    clearance: shipment.exists ? customsClearanceFromShipment(shipment) : null,
    pickupStatus: pickupAppointmentStatuses.includes(status as PickupAppointmentStatus) ? status as PickupAppointmentStatus : null,
  };
}
