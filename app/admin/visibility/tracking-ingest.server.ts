import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import type { ShipmentEvent, ShipmentStatus } from "../../shipment-types";
import {
  confidenceValue,
  normalizeTrackingMilestone,
  trackingMilestoneLabels,
  type TrackingEvent,
} from "./tracking-visibility";
import { recordTrackingEvent, type RecordTrackingInput } from "./tracking-visibility.server";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const valueText = text(value).trim(); return valueText || null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function branchList(value: unknown): KcplBranch[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))] : []; }
function validIso(value: string | null | undefined) { if (!value) return null; const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function numericEventId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }

async function accessibleShipment(reference: string, context?: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const id = reference.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("shipments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const primary = branchValue(snapshot.get("primary_branch"));
  const branches = [...new Set([...(primary ? [primary] : []), ...branchList(snapshot.get("handling_branches"))])];
  if (!branches.length) return { kind: "invalid_branch" as const };
  if (context && !context.can_access_all_branches && !branches.some((branch) => staffCanAccessBranch(context, branch))) return { kind: "forbidden" as const };
  return { kind: "ready" as const, id, ref, snapshot, primary: primary ?? branches[0] };
}

async function archiveHistoricalEvent(
  scope: Extract<Awaited<ReturnType<typeof accessibleShipment>>, { kind: "ready" }>,
  input: RecordTrackingInput,
  actor: Actor,
  eventTime: string,
) {
  const providerEventId = input.providerEventId?.trim() || null;
  if (providerEventId) {
    const duplicate = await scope.ref.collection("tracking_events").where("provider_event_id", "==", providerEventId).limit(1).get();
    if (!duplicate.empty) return { kind: "duplicate" as const };
  }
  const milestone = normalizeTrackingMilestone(input.rawStatus, input.milestone);
  const receivedAt = new Date().toISOString();
  const id = `track-${Date.now()}-${crypto.randomUUID().slice(0, 10)}`;
  const event: TrackingEvent = {
    id,
    shipment_reference: scope.id,
    milestone,
    title: input.title?.trim() || trackingMilestoneLabels[milestone],
    raw_status: input.rawStatus.trim() || null,
    location: input.location?.trim() || null,
    latitude: input.latitude === null || input.latitude === undefined ? null : Number(input.latitude),
    longitude: input.longitude === null || input.longitude === undefined ? null : Number(input.longitude),
    event_time: eventTime,
    received_at: receivedAt,
    source: input.source,
    provider: input.provider?.trim() || null,
    provider_event_id: providerEventId,
    details: input.details?.trim() || null,
    eta: validIso(input.eta),
    confidence: confidenceValue(input.confidence),
    actor_name: actor.name || null,
    actor_email: actor.email || null,
  };
  const legacyId = numericEventId();
  const legacy: ShipmentEvent = {
    id: legacyId,
    shipment_reference: scope.id,
    title: event.title,
    location: event.location,
    details: [event.details, "Historical carrier event received after a newer movement update"].filter(Boolean).join(" · "),
    event_time: event.event_time,
    created_at: receivedAt,
    author_name: actor.name || event.provider || "KCPL Visibility Engine",
  };
  const batch = firebaseAdminDb().batch();
  batch.set(scope.ref.collection("tracking_events").doc(id), { ...event, historical_event: true });
  batch.set(scope.ref.collection("events").doc(String(legacyId)), legacy);
  batch.set(scope.ref.collection("job_activity").doc(), {
    type: "historical_tracking_event_received",
    title: `Historical tracking event archived: ${event.title}`,
    detail: [event.location, event.provider || event.source].filter(Boolean).join(" · "),
    branch: scope.primary,
    actor_name: actor.name || event.provider || "KCPL Visibility Engine",
    actor_email: actor.email || null,
    created_at: receivedAt,
    tracking_event_id: id,
  });
  await batch.commit();
  return { kind: "created" as const, event, status: text(scope.snapshot.get("status"), "booking_confirmed") as ShipmentStatus, opened_exceptions: [] as string[], historical: true };
}

export async function recordOrderedTrackingEvent(reference: string, input: RecordTrackingInput, actor: Actor, context?: KcplStaffContext) {
  const scope = await accessibleShipment(reference, context);
  if (scope.kind !== "ready") return scope;
  const suppliedEventTime = validIso(input.eventTime);
  const latestEventTime = nullable(scope.snapshot.get("tracking_last_event_at"));
  if (suppliedEventTime && latestEventTime && Date.parse(suppliedEventTime) < Date.parse(latestEventTime)) {
    return archiveHistoricalEvent(scope, input, actor, suppliedEventTime);
  }
  return recordTrackingEvent(reference, input, actor, context);
}
