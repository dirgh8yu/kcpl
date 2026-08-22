import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { shipmentStatuses, type ShipmentEvent, type ShipmentStatus } from "../../shipment-types";
import {
  confidenceValue,
  etaDeltaHours,
  isTrackingStale,
  normalizeTrackingMilestone,
  shouldOpenEtaDelayException,
  summarizeVisibility,
  trackingMilestoneLabels,
  trackingSources,
  trackingStaleAfter,
  type TrackingEvent,
  type TrackingMilestone,
  type TrackingSource,
  type VisibilityShipment,
} from "./tracking-visibility";
import { evaluateExternalPromotion, externalObservationIsMachine, externalObservationIsNewer } from "./external-workflow-state";

type Actor = { name: string; email: string };

export type RecordTrackingInput = {
  rawStatus: string;
  milestone?: string | null;
  title?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  eventTime?: string;
  source: TrackingSource;
  provider?: string;
  providerEventId?: string;
  details?: string;
  eta?: string;
  confidence?: number | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const v = text(value).trim(); return v || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function branchList(value: unknown): KcplBranch[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))] : []; }
function statusValue(value: unknown): ShipmentStatus { return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed"; }
function sourceValue(value: unknown): TrackingSource | null { return trackingSources.includes(value as TrackingSource) ? value as TrackingSource : null; }
function trackingMilestoneValue(value: unknown): TrackingMilestone | null {
  const candidate = text(value) as TrackingMilestone;
  return candidate && Object.prototype.hasOwnProperty.call(trackingMilestoneLabels, candidate) ? candidate : null;
}
function numericEventId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }
function validIso(value: string | null | undefined) { if (!value) return null; const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function observationFingerprint(reference: string, event: Pick<TrackingEvent, "source" | "provider" | "provider_event_id" | "milestone" | "raw_status" | "event_time" | "location">) {
  const identity = event.provider_event_id
    ? [reference, event.source, event.provider ?? "", event.provider_event_id]
    : [reference, event.source, event.provider ?? "", event.milestone, event.raw_status ?? "", event.event_time, event.location ?? ""];
  return createHash("sha256").update(identity.join("\n")).digest("hex");
}
function blockingOperationalException(data: Record<string, unknown>) {
  const status = text(data.status).toLowerCase();
  const severity = text(data.severity).toLowerCase();
  return !["resolved", "closed"].includes(status) && ["high", "critical"].includes(severity);
}

async function shipmentScope(reference: string, context?: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const id = reference.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("shipments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const primary = branchValue(data.primary_branch);
  const handling = branchList(data.handling_branches);
  const branches = [...new Set([...(primary ? [primary] : []), ...handling])];
  if (!branches.length) return { kind: "invalid_branch" as const };
  if (context && !context.can_access_all_branches && !branches.some((branch) => staffCanAccessBranch(context, branch))) return { kind: "forbidden" as const };
  return { kind: "ready" as const, id, ref, snapshot, data, primary: primary ?? branches[0], branches };
}

function trackingEventFromData(id: string, shipmentReference: string, data: Record<string, unknown>): TrackingEvent {
  return {
    id,
    shipment_reference: shipmentReference,
    milestone: trackingMilestoneValue(data.milestone) ?? "unknown",
    title: text(data.title, "Tracking update"),
    raw_status: nullable(data.raw_status),
    location: nullable(data.location),
    latitude: numberValue(data.latitude),
    longitude: numberValue(data.longitude),
    event_time: text(data.event_time),
    received_at: text(data.received_at),
    source: sourceValue(data.source) ?? "manual",
    provider: nullable(data.provider),
    provider_event_id: nullable(data.provider_event_id),
    details: nullable(data.details),
    eta: nullable(data.eta),
    confidence: confidenceValue(data.confidence),
    actor_name: nullable(data.actor_name),
    actor_email: nullable(data.actor_email),
  };
}

async function loadDocumentsByIds(collectionName: string, ids: string[]) {
  const db = firebaseAdminDb();
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < unique.length; index += 250) {
    const snapshots = await db.getAll(...unique.slice(index, index + 250).map((id) => db.collection(collectionName).doc(id)));
    for (const snapshot of snapshots) if (snapshot.exists) result.set(snapshot.id, snapshot.data() as Record<string, unknown>);
  }
  return result;
}

function visibilityFromData(id: string, data: Record<string, unknown>, customerName: string, origin: string, destination: string, mode: string, nowIso: string): VisibilityShipment | null {
  const primary = branchValue(data.primary_branch);
  const handling = branchList(data.handling_branches);
  const effectivePrimary = primary ?? handling[0];
  if (!effectivePrimary) return null;
  if (!handling.includes(effectivePrimary)) handling.unshift(effectivePrimary);
  const status = statusValue(data.status);
  const lastEventAt = nullable(data.tracking_last_event_at);
  const originalEta = nullable(data.tracking_original_eta);
  const eta = nullable(data.eta);
  return {
    reference: id,
    quote_reference: text(data.quote_reference),
    customer_id: nullable(data.customer_id),
    customer_name: customerName,
    origin,
    destination,
    mode,
    primary_branch: effectivePrimary,
    handling_branches: handling,
    status,
    carrier: nullable(data.carrier),
    carrier_reference: nullable(data.carrier_reference),
    eta,
    original_eta: originalEta,
    current_location: nullable(data.current_location),
    last_milestone: trackingMilestoneValue(data.tracking_last_milestone),
    last_event_at: lastEventAt,
    last_received_at: nullable(data.tracking_last_received_at),
    last_source: sourceValue(data.tracking_last_source),
    last_provider: nullable(data.tracking_last_provider),
    observed_external_milestone: trackingMilestoneValue(data.external_observed_milestone),
    observed_external_at: nullable(data.external_observed_at),
    observed_external_provider: nullable(data.external_observed_provider),
    external_reconciliation_status: nullable(data.external_reconciliation_status),
    external_promotion_blocker: nullable(data.external_promotion_blocker),
    stale_after: nullable(data.tracking_stale_after),
    stale: isTrackingStale(lastEventAt, status, mode, nowIso),
    eta_delta_hours: etaDeltaHours(originalEta, eta),
    updated_at: text(data.updated_at),
  };
}

export async function listTrackingVisibility(context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const snapshot = await db.collection("shipments").limit(2000).get();
  const accessible = snapshot.docs.filter((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const branches = [...new Set([...(branchValue(data.primary_branch) ? [branchValue(data.primary_branch)!] : []), ...branchList(data.handling_branches)])];
    return context.can_access_all_branches || branches.some((branch) => staffCanAccessBranch(context, branch));
  });
  const quoteIds = accessible.map((doc) => text(doc.get("quote_reference"))).filter(Boolean);
  const customerIds = accessible.map((doc) => nullable(doc.get("customer_id"))).filter((id): id is string => Boolean(id));
  const [quotes, customers] = await Promise.all([loadDocumentsByIds("quotes", quoteIds), loadDocumentsByIds("customers", customerIds)]);
  const nowIso = new Date().toISOString();
  const rows = accessible.flatMap((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const quote = quotes.get(text(data.quote_reference)) ?? {};
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) : undefined;
    const row = visibilityFromData(doc.id, data, customer ? text(customer.display_name, "Linked customer") : text(quote.company_name, text(quote.contact_name, "Customer")), text(quote.origin, text(data.origin)), text(quote.destination, text(data.destination)), text(quote.mode, text(data.mode)), nowIso);
    return row ? [row] : [];
  }).sort((a, b) => Number(b.stale) - Number(a.stale) || (b.eta_delta_hours ?? 0) - (a.eta_delta_hours ?? 0) || b.updated_at.localeCompare(a.updated_at));
  return { kind: "ready" as const, rows, summary: summarizeVisibility(rows, nowIso), generated_at: nowIso };
}

export async function getShipmentTrackingVisibility(reference: string, context: KcplStaffContext) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  const snapshot = await scope.ref.collection("tracking_events").orderBy("event_time", "desc").limit(300).get();
  const events = snapshot.docs.map((doc) => trackingEventFromData(doc.id, scope.id, doc.data() as Record<string, unknown>));
  return { kind: "ready" as const, events };
}

async function openAutoException(scope: Extract<Awaited<ReturnType<typeof shipmentScope>>, { kind: "ready" }>, triggerKey: string, category: "delay" | "delivery_refusal" | "carrier", severity: "medium" | "high", title: string, detail: string, now: string) {
  const existing = await scope.ref.collection("exceptions").where("tracking_trigger_key", "==", triggerKey).limit(1).get();
  if (!existing.empty) return false;
  const exceptionRef = scope.ref.collection("exceptions").doc();
  const activityRef = scope.ref.collection("job_activity").doc();
  const slaHours = severity === "high" ? 6 : 24;
  const data = {
    category, severity, status: "open", title, detail, operational_impact: detail, branch: scope.primary,
    assigned_to_name: null, assigned_to_email: null,
    sla_due_at: new Date(Date.parse(now) + slaHours * 3_600_000).toISOString(),
    opened_at: now, opened_by_name: "KCPL Visibility Engine", opened_by_email: "tracking@kcpl.internal",
    updated_at: now, updated_by_name: "KCPL Visibility Engine", updated_by_email: "tracking@kcpl.internal",
    resolved_at: null, resolved_by_name: null, resolved_by_email: null, resolution: null,
    tracking_trigger_key: triggerKey, source: "tracking_visibility",
  };
  const batch = firebaseAdminDb().batch();
  batch.set(exceptionRef, data);
  batch.set(activityRef, { type: "tracking_exception_opened", title, detail, branch: scope.primary, actor_name: "KCPL Visibility Engine", actor_email: "tracking@kcpl.internal", created_at: now, exception_id: exceptionRef.id, tracking_trigger_key: triggerKey });
  await batch.commit();
  return true;
}

export async function recordTrackingEvent(reference: string, input: RecordTrackingInput, actor: Actor, context?: KcplStaffContext) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  if (!trackingSources.includes(input.source)) return { kind: "invalid_source" as const };
  const eventTime = validIso(input.eventTime) ?? new Date().toISOString();
  const eta = validIso(input.eta);
  const latitude = input.latitude === null || input.latitude === undefined ? null : Number(input.latitude);
  const longitude = input.longitude === null || input.longitude === undefined ? null : Number(input.longitude);
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return { kind: "invalid_coordinates" as const };
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return { kind: "invalid_coordinates" as const };

  const rawStatus = input.rawStatus.trim();
  const milestone = normalizeTrackingMilestone(rawStatus, input.milestone);
  const receivedAt = new Date().toISOString();
  const currentEta = nullable(scope.data.eta);
  const originalEta = nullable(scope.data.tracking_original_eta) ?? currentEta ?? eta;
  const mode = text(scope.data.mode);
  const eventBase: TrackingEvent = {
    id: "",
    shipment_reference: scope.id,
    milestone,
    title: input.title?.trim() || trackingMilestoneLabels[milestone],
    raw_status: rawStatus || null,
    location: input.location?.trim() || null,
    latitude,
    longitude,
    event_time: eventTime,
    received_at: receivedAt,
    source: input.source,
    provider: input.provider?.trim() || null,
    provider_event_id: input.providerEventId?.trim() || null,
    details: input.details?.trim() || null,
    eta,
    confidence: confidenceValue(input.confidence),
    actor_name: actor.name || null,
    actor_email: actor.email || null,
  };
  const fingerprint = observationFingerprint(scope.id, eventBase);
  const event: TrackingEvent = { ...eventBase, id: fingerprint };
  const eventRef = scope.ref.collection("tracking_events").doc(fingerprint);
  const db = firebaseAdminDb();

  const result = await db.runTransaction(async (transaction) => {
    const shipmentSnapshot = await transaction.get(scope.ref);
    if (!shipmentSnapshot.exists) return { kind: "missing" as const };
    const duplicateSnapshot = await transaction.get(eventRef);
    if (duplicateSnapshot.exists) return { kind: "duplicate" as const, data: duplicateSnapshot.data() as Record<string, unknown> };
    const exceptionSnapshot = await transaction.get(scope.ref.collection("exceptions").limit(100));
    const shipment = shipmentSnapshot.data() as Record<string, unknown>;
    const canonicalBefore = statusValue(shipment.status);
    const currentLastAt = nullable(shipment.tracking_last_event_at);
    const late = Boolean(currentLastAt && Date.parse(event.event_time) < Date.parse(currentLastAt));
    const hasBlockingException = exceptionSnapshot.docs.some((doc) => blockingOperationalException(doc.data() as Record<string, unknown>));
    const promotion = evaluateExternalPromotion({
      canonicalStatus: canonicalBefore,
      observedMilestone: milestone,
      source: event.source,
      direction: nullable(shipment.direction),
      customsClearanceStatus: nullable(shipment.customs_clearance_status),
      podStatus: nullable(shipment.delivery_pod_status),
      pickupStatus: nullable(shipment.pickup_status),
      deliveryWorkflowComplete: text(shipment.delivery_last_attempt_status) === "delivered" && text(shipment.delivery_pod_status) === "verified",
      hasBlockingException,
      isLateObservation: late,
    });
    const canonicalAfter = promotion.decision === "promote" && promotion.targetStatus ? promotion.targetStatus : canonicalBefore;
    const latestTracking = externalObservationIsNewer(currentLastAt, event.event_time);
    const currentExternalAt = nullable(shipment.external_observed_at);
    const latestExternal = externalObservationIsMachine(event.source) && externalObservationIsNewer(currentExternalAt, event.event_time);
    const storedEvent = {
      ...event,
      idempotency_fingerprint: fingerprint,
      promotion_decision: promotion.decision,
      promotion_reason: promotion.reason,
      canonical_status_before: canonicalBefore,
      canonical_status_after: canonicalAfter,
    };
    const legacyId = numericEventId();
    const legacyEvent: ShipmentEvent = {
      id: legacyId, shipment_reference: scope.id, title: event.title, location: event.location,
      details: [event.details, event.provider ? `Source: ${event.provider}` : null].filter(Boolean).join(" · ") || null,
      event_time: event.event_time, created_at: receivedAt, author_name: actor.name || event.provider || "KCPL Visibility Engine",
    };
    transaction.create(eventRef, storedEvent);
    transaction.set(scope.ref.collection("events").doc(String(legacyId)), legacyEvent);
    transaction.set(scope.ref.collection("job_activity").doc(`tracking-${fingerprint.slice(0, 48)}`), {
      type: "tracking_event_received", title: event.title,
      detail: [event.location, event.provider ? `${event.source}: ${event.provider}` : event.source, eta ? `ETA ${eta}` : null, `Canonical: ${canonicalBefore}`, `Decision: ${promotion.decision} (${promotion.reason})`].filter(Boolean).join(" · "),
      branch: scope.primary, actor_name: actor.name || event.provider || "KCPL Visibility Engine", actor_email: actor.email || null,
      created_at: receivedAt, tracking_event_id: fingerprint, idempotency_fingerprint: fingerprint,
    });
    if (canonicalAfter !== canonicalBefore) {
      transaction.set(scope.ref.collection("job_activity").doc(`external-promotion-${fingerprint.slice(0, 40)}`), {
        type: "external_workflow_promotion", title: `External observation promoted workflow to ${canonicalAfter.replaceAll("_", " ")}`,
        detail: `${event.provider ?? event.source} observed ${milestone.replaceAll("_", " ")}. ${promotion.reason}.`,
        branch: scope.primary, actor_name: "KCPL External Reconciliation", actor_email: "external-reconciliation@kcpl.internal",
        created_at: receivedAt, tracking_event_id: fingerprint, source: event.source, provider: event.provider,
        previous_canonical_status: canonicalBefore, new_canonical_status: canonicalAfter, observed_milestone: milestone,
        promotion_decision: promotion.decision, promotion_reason: promotion.reason, idempotency_fingerprint: fingerprint,
      });
    }
    const update: Record<string, unknown> = {
      status: canonicalAfter,
      tracking_original_eta: originalEta ?? null,
      updated_at: receivedAt,
    };
    if (latestTracking) {
      Object.assign(update, {
        tracking_last_event_at: event.event_time,
        tracking_last_received_at: receivedAt,
        tracking_last_milestone: milestone,
        tracking_last_source: event.source,
        tracking_last_provider: event.provider,
        tracking_stale_after: trackingStaleAfter(event.event_time, canonicalAfter, mode),
      });
      if (event.location) update.current_location = event.location;
      if (eta) update.eta = eta;
    }
    if (latestExternal) {
      Object.assign(update, {
        external_observed_milestone: milestone,
        external_observed_at: event.event_time,
        external_observed_received_at: receivedAt,
        external_observed_provider: event.provider,
        external_observed_source: event.source,
        external_observation_confidence: event.confidence,
        external_reconciliation_status: promotion.decision,
        external_promotion_blocker: promotion.decision === "blocked" ? promotion.reason : null,
      });
    }
    transaction.update(scope.ref, update);
    return { kind: "created" as const, canonicalAfter, promotion };
  });

  if (result.kind === "duplicate") return { kind: "duplicate" as const, event: trackingEventFromData(fingerprint, scope.id, result.data) };
  if (result.kind !== "created") return result;

  const openedExceptions: string[] = [];
  if (milestone === "delivery_refused") {
    if (await openAutoException(scope, `delivery-refused:${fingerprint}`, "delivery_refusal", "high", "Delivery refused by consignee", event.details || event.raw_status || "Carrier tracking reported a refused delivery.", receivedAt)) openedExceptions.push("Delivery refused by consignee");
  }
  if (milestone === "exception") {
    if (await openAutoException(scope, `carrier-exception:${fingerprint}`, "carrier", "high", "Carrier tracking exception", event.details || event.raw_status || "Carrier tracking reported an operational exception.", receivedAt)) openedExceptions.push("Carrier tracking exception");
  }
  if (eta && shouldOpenEtaDelayException(currentEta, eta, 24)) {
    const delay = etaDeltaHours(currentEta, eta) ?? 0;
    if (await openAutoException(scope, `eta-delay:${fingerprint}`, "delay", "medium", `ETA slipped by ${Math.round(delay)} hours`, `Tracking moved ETA from ${currentEta} to ${eta}.`, receivedAt)) openedExceptions.push("ETA delay");
  }
  return { kind: "created" as const, event, status: result.canonicalAfter, promotion: result.promotion, opened_exceptions: openedExceptions };
}

export async function runTrackingHealthSweep(context?: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const snapshot = await db.collection("shipments").limit(2000).get();
  const nowIso = new Date().toISOString();
  let checked = 0;
  let opened = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const status = statusValue(data.status);
    if (status === "delivered") continue;
    const scope = await shipmentScope(doc.id, context);
    if (scope.kind !== "ready") continue;
    checked += 1;
    const mode = text(data.mode);
    const lastEventAt = nullable(data.tracking_last_event_at);
    if (!isTrackingStale(lastEventAt, status, mode, nowIso)) continue;
    const key = `tracking-stale:${lastEventAt ?? "no-feed"}`;
    const detail = lastEventAt ? `No tracking event has been recorded since ${lastEventAt}.` : "No normalized tracking feed has been recorded for this active shipment.";
    if (await openAutoException(scope, key, "carrier", "medium", "Tracking feed is stale", detail, nowIso)) opened += 1;
  }
  return { kind: "ready" as const, checked, opened, generated_at: nowIso };
}
