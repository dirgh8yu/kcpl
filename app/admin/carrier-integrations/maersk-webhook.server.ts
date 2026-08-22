import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { resolveCanonicalRecordCandidates } from "../canonical-record-match";
import { recordOrderedTrackingEvent } from "../visibility/tracking-ingest.server";
import { dcsaPayloadEvents, type DcsaTrackingEvent } from "./carrier-integrations";

function eventHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function recordWebhookHealth(ok: boolean, message: string) {
  if (!firebaseRuntimeConfigured()) return;
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("carrier_integrations").doc("maersk_ocean").set({
    provider: "maersk_ocean",
    last_action: "dcsa_webhook",
    ...(ok ? { last_success_at: now } : { last_failure_at: now }),
    last_http_status: ok ? 200 : 409,
    last_message: message.slice(0, 500),
    last_latency_ms: null,
    updated_at: now,
  }, { merge: true });
}

/**
 * Every identifier supplied by the provider participates in matching. We never
 * stop at the first one-match query because a second identifier may resolve to a
 * different shipment or branch. The union must contain exactly one shipment.
 */
export async function matchMaerskShipmentForEvent(event: DcsaTrackingEvent) {
  const db = firebaseAdminDb();
  const checks: Array<[string, string | null]> = [
    ["booking_reference", event.carrierBookingReference],
    ["carrier_reference", event.transportDocumentReference],
    ["transport_document_reference", event.transportDocumentReference],
    ["carrier_reference", event.equipmentReference],
    ["tracking_number", event.equipmentReference],
  ];
  const matches = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const [field, value] of checks) {
    if (!value) continue;
    const snapshot = await db.collection("shipments").where(field, "==", value).limit(3).get();
    for (const doc of snapshot.docs) matches.set(doc.id, doc);
  }
  const resolution = resolveCanonicalRecordCandidates(
    [...matches.values()].map((doc) => ({ id: doc.id, branch: doc.get("primary_branch") })),
  );
  if (resolution.kind === "missing") return { kind: "missing" as const };
  if (resolution.kind === "ambiguous") return { kind: "ambiguous" as const, references: resolution.ids };
  if (resolution.kind === "invalid_branch") return { kind: "invalid_branch" as const, references: [resolution.id] };
  const shipment = matches.get(resolution.id);
  if (!shipment) return { kind: "missing" as const };
  return { kind: "ready" as const, shipment, branch: resolution.branch };
}

export async function ingestMaerskDcsaPayloadSafely(payload: unknown) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const events = dcsaPayloadEvents(payload);
  if (!events.length) return { kind: "invalid" as const };
  const db = firebaseAdminDb();
  let created = 0;
  let duplicates = 0;
  let historical = 0;
  let unmatched = 0;
  let ambiguous = 0;
  let invalidBranch = 0;

  for (const event of events) {
    const match = await matchMaerskShipmentForEvent(event);
    if (match.kind !== "ready") {
      const id = eventHash(`maersk|${event.providerEventId}`);
      await db.collection("carrier_integration_unmatched_events").doc(id).set({
        provider: "maersk_ocean",
        provider_event_id: event.providerEventId,
        event_time: event.eventTime,
        raw_status: event.rawStatus,
        milestone: event.milestone,
        location: event.location || null,
        carrier_booking_reference: event.carrierBookingReference,
        transport_document_reference: event.transportDocumentReference,
        equipment_reference: event.equipmentReference,
        resolution_state: match.kind,
        candidate_shipments: "references" in match ? match.references : [],
        received_at: new Date().toISOString(),
      }, { merge: true });
      if (match.kind === "ambiguous") ambiguous += 1;
      else if (match.kind === "invalid_branch") invalidBranch += 1;
      else unmatched += 1;
      continue;
    }

    const saved = await recordOrderedTrackingEvent(match.shipment.id, {
      rawStatus: event.rawStatus,
      milestone: event.milestone,
      title: event.title,
      location: event.location,
      latitude: null,
      longitude: null,
      eventTime: event.eventTime,
      source: "webhook",
      provider: "Maersk Ocean DCSA Track & Trace",
      providerEventId: eventHash(event.providerEventId),
      details: event.details,
      eta: "",
      confidence: 1,
    }, { name: "Maersk Ocean DCSA", email: "maersk-tracking@kcpl.internal" });
    if (saved.kind === "created") {
      created += 1;
      if ("historical" in saved && saved.historical) historical += 1;
    } else if (saved.kind === "duplicate") duplicates += 1;
    else if (saved.kind === "invalid_branch") {
      invalidBranch += 1;
      continue;
    }

    await match.shipment.ref.update({
      carrier_integration_provider: "maersk_ocean",
      carrier_integration_last_sync_at: new Date().toISOString(),
      carrier_integration_last_error: null,
      ...(event.transportDocumentReference ? { transport_document_reference: event.transportDocumentReference } : {}),
      updated_at: new Date().toISOString(),
    });
  }

  const message = `${events.length} DCSA event${events.length === 1 ? "" : "s"} received · ${created} new · ${unmatched} unmatched · ${ambiguous} ambiguous · ${invalidBranch} invalid-branch.`;
  await recordWebhookHealth(true, message);
  return { kind: "ready" as const, received: events.length, created, duplicates, historical, unmatched, ambiguous, invalidBranch };
}
