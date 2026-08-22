import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import type { ShipmentEvent, ShipmentStatus } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  canonicalShipmentStatus,
  deriveExternalObservationExceptions,
  evaluateExternalPromotion,
  externalObservationIsLate,
  externalObservationIsMachine,
  externalObservationIsNewer,
  type ExternalDerivedExceptionPlan,
} from "./external-workflow-state";
import {
  confidenceValue,
  etaDeltaHours,
  isTrackingStale,
  normalizeTrackingMilestone,
  summarizeVisibility,
  trackingMilestoneLabels,
  trackingSources,
  trackingStaleAfter,
  type TrackingEvent,
  type TrackingMilestone,
  type TrackingSource,
  type VisibilityShipment,
} from "./tracking-visibility";

type Actor = { name: string; email: string };

type ReadyShipmentScope = {
  kind: "ready";
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  snapshot: FirebaseFirestore.DocumentSnapshot;
  data: Record<string, unknown>;
  primary: KcplBranch;
  branches: KcplBranch[];
};

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
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function branchList(value: unknown): KcplBranch[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))] : []; }
function statusValue(value: unknown): ShipmentStatus { return canonicalShipmentStatus(value) ?? "booking_confirmed"; }
function sourceValue(value: unknown): TrackingSource | null { return trackingSources.includes(value as TrackingSource) ? value as TrackingSource : null; }
function trackingMilestoneValue(value: unknown): TrackingMilestone | null {
  const candidate = text(value) as TrackingMilestone;
  return candidate && Object.prototype.hasOwnProperty.call(trackingMilestoneLabels, candidate) ? candidate : null;
}
function validIso(value: string | null | undefined) { if (!value) return null; const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function observationFingerprint(reference: string, event: Pick<TrackingEvent, "source" | "provider" | "provider_event_id" | "milestone" | "raw_status" | "event_time" | "location">) {
  const identity = event.provider_event_id
    ? [reference, event.source, event.provider ?? "", event.provider_event_id]
    : [reference, event.source, event.provider ?? "", event.milestone, event.raw_status ?? "", event.event_time, event.location ?? ""];
  return createHash("sha256").update(identity.join("\n")).digest("hex");
}
function legacyEventNumericId(fingerprint: string) { return Number.parseInt(fingerprint.slice(0, 12), 16); }
function legacyEventDocId(fingerprint: string) { return `external-${fingerprint}`; }
function trackingActivityDocId(fingerprint: string) { return `tracking-${fingerprint}`; }
function promotionActivityDocId(fingerprint: string) { return `external-promotion-${fingerprint}`; }
function derivedExceptionDocId(fingerprint: string, kind: ExternalDerivedExceptionPlan["kind"]) { return `tracking-${kind}-${fingerprint}`; }
function derivedExceptionActivityDocId(fingerprint: string, kind: ExternalDerivedExceptionPlan["kind"]) { return `tracking-exception-${kind}-${fingerprint}`; }

function derivedExceptionPlans(value: unknown): ExternalDerivedExceptionPlan[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const data = item as Record<string, unknown>;
    const kind = text(data.kind) as ExternalDerivedExceptionPlan["kind"];
    const category = text(data.category) as ExternalDerivedExceptionPlan["category"];
    const severity = text(data.severity) as ExternalDerivedExceptionPlan["severity"];
    if (!["delivery_refused", "carrier_exception", "eta_delay"].includes(kind)) return [];
    if (!["delay", "delivery_refusal", "carrier"].includes(category)) return [];
    if (!["medium", "high"].includes(severity)) return [];
    return [{
      kind,
      triggerKey: text(data.triggerKey),
      category,
      severity,
      title: text(data.title, "Tracking exception"),
      detail: text(data.detail, "Carrier tracking requires KCPL review."),
    }];
  });
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
  return { kind: "ready" as const, id, ref, snapshot, data, primary: primary ?? branches[0], branches } satisfies ReadyShipmentScope;
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

function blockerQueries(scope: ReadyShipmentScope) {
  const exceptions = scope.ref.collection("exceptions");
  return [
    exceptions.where("status", "==", "open").where("severity", "==", "high").limit(1),
    exceptions.where("status", "==", "monitoring").where("severity", "==", "high").limit(1),
    exceptions.where("status", "==", "open").where("severity", "==", "critical").limit(1),
    exceptions.where("status", "==", "monitoring").where("severity", "==", "critical").limit(1),
  ];
}

function derivedExceptionData(plan: ExternalDerivedExceptionPlan, branch: KcplBranch, now: string) {
  const slaHours = plan.severity === "high" ? 6 : 24;
  return {
    category: plan.category,
    severity: plan.severity,
    status: "open",
    title: plan.title,
    detail: plan.detail,
    operational_impact: plan.detail,
    branch,
    assigned_to_name: null,
    assigned_to_email: null,
    sla_due_at: new Date(Date.parse(now) + slaHours * 3_600_000).toISOString(),
    opened_at: now,
    opened_by_name: "KCPL Visibility Engine",
    opened_by_email: "tracking@kcpl.internal",
    updated_at: now,
    updated_by_name: "KCPL Visibility Engine",
    updated_by_email: "tracking@kcpl.internal",
    resolved_at: null,
    resolved_by_name: null,
    resolved_by_email: null,
    resolution: null,
    tracking_trigger_key: plan.triggerKey,
    source: "tracking_visibility",
  };
}

async function repairDerivedExceptions(
  transaction: FirebaseFirestore.Transaction,
  scope: ReadyShipmentScope,
  fingerprint: string,
  branch: KcplBranch,
  plans: ExternalDerivedExceptionPlan[],
  receivedAt: string,
) {
  const refs = plans.map((plan) => scope.ref.collection("exceptions").doc(derivedExceptionDocId(fingerprint, plan.kind)));
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
  let repaired = 0;
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    const exceptionRef = refs[index];
    if (!snapshots[index].exists) {
      transaction.create(exceptionRef, derivedExceptionData(plan, branch, receivedAt));
      repaired += 1;
    }
    transaction.set(scope.ref.collection("job_activity").doc(derivedExceptionActivityDocId(fingerprint, plan.kind)), {
      type: "tracking_exception_opened",
      title: plan.title,
      detail: plan.detail,
      branch,
      actor_name: "KCPL Visibility Engine",
      actor_email: "tracking@kcpl.internal",
      created_at: receivedAt,
      exception_id: exceptionRef.id,
      tracking_trigger_key: plan.triggerKey,
      idempotency_fingerprint: fingerprint,
    }, { merge: true });
  }
  return repaired;
}

function writeObservationAncillaryEffects(
  transaction: FirebaseFirestore.Transaction,
  scope: ReadyShipmentScope,
  fingerprint: string,
  event: TrackingEvent,
  branch: KcplBranch,
  canonicalBefore: ShipmentStatus | null,
  canonicalAfter: ShipmentStatus | null,
  promotionDecision: string,
  promotionReason: string,
  historical: boolean,
) {
  const legacyId = legacyEventNumericId(fingerprint);
  const legacyEvent: ShipmentEvent = {
    id: legacyId,
    shipment_reference: scope.id,
    title: event.title,
    location: event.location,
    details: [event.details, event.provider ? `Source: ${event.provider}` : null, historical ? "Historical carrier event received after a newer observation" : null].filter(Boolean).join(" · ") || null,
    event_time: event.event_time,
    created_at: event.received_at,
    author_name: event.actor_name || event.provider || "KCPL Visibility Engine",
  };
  transaction.set(scope.ref.collection("events").doc(legacyEventDocId(fingerprint)), legacyEvent, { merge: true });
  transaction.set(scope.ref.collection("job_activity").doc(trackingActivityDocId(fingerprint)), {
    type: historical ? "historical_tracking_event_received" : "tracking_event_received",
    title: historical ? `Historical tracking event archived: ${event.title}` : event.title,
    detail: [event.location, event.provider ? `${event.source}: ${event.provider}` : event.source, event.eta ? `ETA ${event.eta}` : null, canonicalBefore ? `Canonical: ${canonicalBefore}` : "Canonical: invalid", `Decision: ${promotionDecision} (${promotionReason})`].filter(Boolean).join(" · "),
    branch,
    actor_name: event.actor_name || event.provider || "KCPL Visibility Engine",
    actor_email: event.actor_email,
    created_at: event.received_at,
    tracking_event_id: fingerprint,
    idempotency_fingerprint: fingerprint,
  }, { merge: true });
  if (canonicalBefore && canonicalAfter && canonicalAfter !== canonicalBefore) {
    transaction.set(scope.ref.collection("job_activity").doc(promotionActivityDocId(fingerprint)), {
      type: "external_workflow_promotion",
      title: `External observation promoted workflow to ${canonicalAfter.replaceAll("_", " ")}`,
      detail: `${event.provider ?? event.source} observed ${event.milestone.replaceAll("_", " ")}. ${promotionReason}.`,
      branch,
      actor_name: "KCPL External Reconciliation",
      actor_email: "external-reconciliation@kcpl.internal",
      created_at: event.received_at,
      tracking_event_id: fingerprint,
      source: event.source,
      provider: event.provider,
      previous_canonical_status: canonicalBefore,
      new_canonical_status: canonicalAfter,
      observed_milestone: event.milestone,
      promotion_decision: promotionDecision,
      promotion_reason: promotionReason,
      idempotency_fingerprint: fingerprint,
    }, { merge: true });
  }
}

async function openAutoException(scope: ReadyShipmentScope, triggerKey: string, category: "delay" | "delivery_refusal" | "carrier", severity: "medium" | "high", title: string, detail: string, now: string) {
  const fingerprint = createHash("sha256").update(`${scope.id}\n${triggerKey}`).digest("hex");
  const exceptionRef = scope.ref.collection("exceptions").doc(`tracking-health-${fingerprint}`);
  const activityRef = scope.ref.collection("job_activity").doc(`tracking-health-${fingerprint}`);
  return firebaseAdminDb().runTransaction(async (transaction) => {
    const [deterministic, legacy] = await Promise.all([
      transaction.get(exceptionRef),
      transaction.get(scope.ref.collection("exceptions").where("tracking_trigger_key", "==", triggerKey).limit(1)),
    ]);
    if (deterministic.exists || !legacy.empty) return false;
    const plan: ExternalDerivedExceptionPlan = { kind: "carrier_exception", triggerKey, category, severity, title, detail };
    transaction.create(exceptionRef, derivedExceptionData(plan, scope.primary, now));
    transaction.set(activityRef, {
      type: "tracking_exception_opened",
      title,
      detail,
      branch: scope.primary,
      actor_name: "KCPL Visibility Engine",
      actor_email: "tracking@kcpl.internal",
      created_at: now,
      exception_id: exceptionRef.id,
      tracking_trigger_key: triggerKey,
    });
    return true;
  });
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
    const shipment = shipmentSnapshot.data() as Record<string, unknown>;
    const canonicalPrimary = branchValue(shipment.primary_branch);
    const machine = externalObservationIsMachine(event.source);
    if (machine && !canonicalPrimary) return { kind: "invalid_branch" as const };
    const activityBranch = canonicalPrimary ?? scope.primary;

    const duplicateSnapshot = await transaction.get(eventRef);
    if (duplicateSnapshot.exists) {
      const stored = duplicateSnapshot.data() as Record<string, unknown>;
      const storedEvent = trackingEventFromData(fingerprint, scope.id, stored);
      const plans = derivedExceptionPlans(stored.derived_exceptions);
      const repaired = await repairDerivedExceptions(transaction, scope, fingerprint, activityBranch, plans, text(stored.received_at, receivedAt));
      const canonicalBefore = canonicalShipmentStatus(stored.canonical_status_before);
      const canonicalAfter = canonicalShipmentStatus(stored.canonical_status_after);
      const promotionDecision = text(stored.promotion_decision, "no_change");
      const promotionReason = text(stored.promotion_reason, "duplicate_observation");
      writeObservationAncillaryEffects(transaction, scope, fingerprint, storedEvent, activityBranch, canonicalBefore, canonicalAfter, promotionDecision, promotionReason, stored.historical_event === true);
      return { kind: "duplicate" as const, data: stored, repaired };
    }

    const canonicalBefore = canonicalShipmentStatus(shipment.status);
    const blockerSnapshots = canonicalBefore && machine
      ? await Promise.all(blockerQueries(scope).map((query) => transaction.get(query)))
      : [];
    const hasBlockingException = blockerSnapshots.some((snapshot) => !snapshot.empty);
    const currentLastAt = nullable(shipment.tracking_last_event_at);
    const currentExternalAt = nullable(shipment.external_observed_at);
    const late = externalObservationIsLate(currentLastAt, currentExternalAt, event.event_time);
    const currentEta = nullable(shipment.eta);
    const originalEta = nullable(shipment.tracking_original_eta) ?? currentEta ?? eta;
    const mode = text(shipment.mode);
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
    const canonicalAfter = canonicalBefore && promotion.decision === "promote" && promotion.targetStatus ? promotion.targetStatus : canonicalBefore;
    const latestTracking = externalObservationIsNewer(currentLastAt, event.event_time);
    const latestExternal = machine && externalObservationIsNewer(currentExternalAt, event.event_time);
    const plans = deriveExternalObservationExceptions({
      fingerprint,
      milestone,
      rawStatus: event.raw_status,
      details: event.details,
      previousEta: currentEta,
      nextEta: eta,
      isLateObservation: late,
    });
    await repairDerivedExceptions(transaction, scope, fingerprint, activityBranch, plans, receivedAt);

    const storedEvent = {
      ...event,
      idempotency_fingerprint: fingerprint,
      historical_event: late,
      canonical_primary_branch: activityBranch,
      promotion_decision: promotion.decision,
      promotion_reason: promotion.reason,
      canonical_status_before: canonicalBefore,
      canonical_status_after: canonicalAfter,
      eta_previous: currentEta,
      derived_exceptions: plans,
    };
    transaction.create(eventRef, storedEvent);
    writeObservationAncillaryEffects(transaction, scope, fingerprint, event, activityBranch, canonicalBefore, canonicalAfter, promotion.decision, promotion.reason, late);

    const update: Record<string, unknown> = { updated_at: receivedAt };
    if (canonicalBefore && canonicalAfter && canonicalAfter !== canonicalBefore) update.status = canonicalAfter;
    if (latestTracking) {
      Object.assign(update, {
        tracking_last_event_at: event.event_time,
        tracking_last_received_at: receivedAt,
        tracking_last_milestone: milestone,
        tracking_last_source: event.source,
        tracking_last_provider: event.provider,
      });
      if (!nullable(shipment.tracking_original_eta) && originalEta) update.tracking_original_eta = originalEta;
      if (canonicalAfter) update.tracking_stale_after = trackingStaleAfter(event.event_time, canonicalAfter, mode);
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
    return { kind: "created" as const, canonicalAfter, promotion, historical: late, openedExceptions: plans.map((plan) => plan.title) };
  });

  if (result.kind === "duplicate") return { kind: "duplicate" as const, event: trackingEventFromData(fingerprint, scope.id, result.data), repaired_side_effects: result.repaired };
  if (result.kind !== "created") return result;
  return { kind: "created" as const, event, status: result.canonicalAfter, promotion: result.promotion, opened_exceptions: result.openedExceptions, historical: result.historical };
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
