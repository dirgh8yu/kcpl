import { firebaseAdminDb, firebaseRuntimeConfigured } from "./firebase-admin.server";
import { freeTimeStatus, shipmentFreeTimeFromRecord, type FreeTimeStatus, type ShipmentFreeTime } from "./shipment-free-time";
import { nepalOperationalDate } from "./invoice-effective-status";
import type { FreeTimeIngest } from "./free-time-ingest";

/**
 * Read the free-time block off a shipment.
 *
 * Read-only, and kept out of the pages that render it so a Job File or a route
 * does not become a persistence surface just to show a countdown. Callers that
 * need to *write* free time go through the namespaced admin route, which
 * touches free-time fields and nothing canonical.
 */
export async function readShipmentFreeTime(reference: string, today = nepalOperationalDate()): Promise<
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

/**
 * Writes a carrier's allowance onto the namespaced free-time block only.
 *
 * The provider event id is the idempotency key: a retried webhook updates
 * nothing the second time. The Job File gets one line so staff can see where
 * the number came from, but no canonical shipment status, ETA or delivery
 * field is touched here.
 */
export async function applyCarrierFreeTime(input: FreeTimeIngest) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const ref = db.collection("shipments").doc(input.reference);
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { kind: "missing" as const };
      if (String(snapshot.get("free_time_last_provider_event_id") ?? "") === input.provider_event_id) {
        return { kind: "duplicate" as const };
      }
      transaction.update(ref, {
        free_time_location: input.location,
        free_time_days: input.days,
        free_time_started_on: input.started_on,
        free_time_ended_on: input.ended_on,
        free_time_daily_charge: input.daily_charge,
        free_time_charge_currency: input.charge_currency,
        free_time_bearer: input.bearer,
        free_time_note: input.note,
        free_time_updated_at: now,
        free_time_updated_by: `${input.provider} (carrier feed)`,
        free_time_last_provider_event_id: input.provider_event_id,
        free_time_last_provider: input.provider,
        updated_at: now,
      });
      transaction.create(ref.collection("job_activity").doc(`free-time-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`), {
        type: "free_time_ingested",
        title: `Free time received from ${input.provider}`,
        detail: `${input.days} days from ${input.started_on} at ${input.location}${input.daily_charge !== null ? ` · ${input.charge_currency} ${input.daily_charge}/day` : ""}`,
        actor_name: input.provider,
        actor_email: "free-time@kcpl.internal",
        created_at: now,
      });
      return { kind: "created" as const, reference: input.reference };
    });
  } catch (error) {
    console.error("KCPL carrier free-time write failed", error);
    return { kind: "unavailable" as const };
  }
}
