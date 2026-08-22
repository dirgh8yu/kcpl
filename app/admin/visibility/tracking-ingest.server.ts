import type { KcplStaffContext } from "../staff-directory.server";
import { recordTrackingEvent, type RecordTrackingInput } from "./tracking-visibility.server";

type Actor = { name: string; email: string };

/**
 * Ordered provider ingestion deliberately delegates all late-event, idempotency,
 * branch-authority and canonical-promotion decisions to recordTrackingEvent.
 * The shared Firestore transaction rereads the shipment before deciding whether
 * an observation is current or historical, so concurrent older/newer arrivals
 * cannot race a stale preflight snapshot.
 */
export async function recordOrderedTrackingEvent(reference: string, input: RecordTrackingInput, actor: Actor, context?: KcplStaffContext) {
  return recordTrackingEvent(reference, input, actor, context);
}
