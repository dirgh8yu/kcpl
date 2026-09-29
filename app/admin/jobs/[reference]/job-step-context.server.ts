import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { customsClearanceFromShipment } from "../../customs/customs-clearance.server";
import type { CustomsClearanceRecord } from "../../customs/customs-clearance";
import { appointmentId, pickupAppointmentStatuses, type PickupAppointmentStatus } from "../../pickups/pickup-appointments";
import { qaMockDataEnabled } from "../../qa-fixtures";

export type JobPickup = {
  status: PickupAppointmentStatus;
  window_start: string | null;
  window_end: string | null;
  location: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_reference: string | null;
  missed_reason: string | null;
};

export type JobStepContext = {
  clearance: CustomsClearanceRecord | null;
  pickupStatus: PickupAppointmentStatus | null;
  pickup: JobPickup | null;
};

function nullable(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The two facts the Job File checklist needs beyond workflow readiness: the
 * customs clearance record (so release is recorded in place) and the pickup
 * appointment. Branch access is already checked by the page. */
export async function getJobStepContext(reference: string): Promise<JobStepContext> {
  if (qaMockDataEnabled() || !firebaseRuntimeConfigured()) return { clearance: null, pickupStatus: null, pickup: null };
  const db = firebaseAdminDb();
  const id = reference.trim().toUpperCase();
  const [shipment, pickup] = await Promise.all([
    db.collection("shipments").doc(id).get(),
    db.collection("pickup_appointments").doc(appointmentId(id)).get(),
  ]);
  const status = pickup.exists ? pickup.get("status") : null;
  const pickupStatus = pickupAppointmentStatuses.includes(status as PickupAppointmentStatus) ? status as PickupAppointmentStatus : null;
  return {
    clearance: shipment.exists ? customsClearanceFromShipment(shipment) : null,
    pickupStatus,
    pickup: pickupStatus ? {
      status: pickupStatus,
      window_start: nullable(pickup.get("confirmed_window_start")) ?? nullable(pickup.get("requested_window_start")),
      window_end: nullable(pickup.get("confirmed_window_end")) ?? nullable(pickup.get("requested_window_end")),
      location: nullable(pickup.get("pickup_location")),
      contact_name: nullable(pickup.get("contact_name")),
      contact_phone: nullable(pickup.get("contact_phone")),
      driver_name: nullable(pickup.get("driver_name")),
      driver_phone: nullable(pickup.get("driver_phone")),
      vehicle_reference: nullable(pickup.get("vehicle_reference")),
      missed_reason: nullable(pickup.get("missed_reason")),
    } : null,
  };
}
