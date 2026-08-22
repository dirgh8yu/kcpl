import { createHash, randomBytes } from "node:crypto";
import { firebaseAdminBucket, firebaseAdminDb, firebaseRuntimeConfigured, firebaseStorageBucketName } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  deliveryAttemptStatuses,
  deliveryAttemptTransitionAllowed,
  deliveryOutcomeValid,
  deriveDeliveryState,
  podEvidenceKinds,
  podFileAccepted,
  summarizeDelivery,
  type DeliveryAttempt,
  type DeliveryAttemptStatus,
  type DeliveryQueueRow,
  type PodEvidence,
  type PodEvidenceKind,
} from "./delivery-control";

type Actor = { name: string; email: string };

type CreateAttemptInput = {
  scheduledFor: string;
  location: string;
  driverName: string;
  driverPhone: string;
  vehicleReference: string;
  notes: string;
};

type UpdateAttemptInput = {
  status: DeliveryAttemptStatus;
  eventTime: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  recipientName: string;
  recipientPhone: string;
  recipientRelation: string;
  failureReason: string;
  notes: string;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const v = text(value).trim(); return v || null; }
function numberOrNull(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function branchList(value: unknown): KcplBranch[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))] : []; }
function validIso(value: string | null | undefined) { if (!value) return null; const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function id(prefix: string) { return `${prefix}-${Date.now()}-${randomBytes(5).toString("hex")}`; }
function numericId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }

function attemptFromData(idValue: string, reference: string, data: Record<string, unknown>): DeliveryAttempt {
  const rawStatus = text(data.status) as DeliveryAttemptStatus;
  return {
    id: idValue,
    shipment_reference: reference,
    attempt_number: numberOrNull(data.attempt_number) ?? 1,
    status: deliveryAttemptStatuses.includes(rawStatus) ? rawStatus : "scheduled",
    scheduled_for: nullable(data.scheduled_for),
    event_time: nullable(data.event_time),
    location: nullable(data.location),
    latitude: numberOrNull(data.latitude),
    longitude: numberOrNull(data.longitude),
    recipient_name: nullable(data.recipient_name),
    recipient_phone: nullable(data.recipient_phone),
    recipient_relation: nullable(data.recipient_relation),
    driver_name: nullable(data.driver_name),
    driver_phone: nullable(data.driver_phone),
    vehicle_reference: nullable(data.vehicle_reference),
    failure_reason: nullable(data.failure_reason),
    notes: nullable(data.notes),
    created_at: text(data.created_at),
    created_by_name: nullable(data.created_by_name),
    created_by_email: nullable(data.created_by_email),
    updated_at: text(data.updated_at, text(data.created_at)),
    updated_by_name: nullable(data.updated_by_name),
    updated_by_email: nullable(data.updated_by_email),
  };
}

function evidenceFromData(idValue: string, reference: string, data: Record<string, unknown>): PodEvidence {
  const kind = text(data.kind) as PodEvidenceKind;
  const status = text(data.review_status);
  return {
    id: idValue,
    shipment_reference: reference,
    attempt_id: text(data.attempt_id),
    kind: podEvidenceKinds.includes(kind) ? kind : "document",
    filename: text(data.filename, "POD evidence"),
    content_type: text(data.content_type, "application/octet-stream"),
    size_bytes: numberOrNull(data.size_bytes) ?? 0,
    sha256: text(data.sha256),
    review_status: status === "verified" || status === "rejected" ? status : "received",
    customer_safe: data.customer_safe === true,
    captured_at: text(data.captured_at, text(data.uploaded_at)),
    uploaded_at: text(data.uploaded_at),
    uploaded_by_name: nullable(data.uploaded_by_name),
    uploaded_by_email: nullable(data.uploaded_by_email),
    reviewed_at: nullable(data.reviewed_at),
    reviewed_by_name: nullable(data.reviewed_by_name),
    reviewed_by_email: nullable(data.reviewed_by_email),
    review_note: nullable(data.review_note),
  };
}

async function shipmentScope(reference: string, context?: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const normalized = reference.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("shipments").doc(normalized);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const primary = branchValue(data.primary_branch);
  const handling = branchList(data.handling_branches);
  const branches = [...new Set([...(primary ? [primary] : []), ...handling])];
  if (!branches.length) return { kind: "invalid_branch" as const };
  if (context && !context.can_access_all_branches && !branches.some((branch) => staffCanAccessBranch(context, branch))) return { kind: "forbidden" as const };
  return { kind: "ready" as const, reference: normalized, ref, snapshot, data, primary: primary ?? branches[0], branches };
}

async function loadDocumentsByIds(collectionName: string, ids: string[]) {
  const db = firebaseAdminDb();
  const unique = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < unique.length; index += 250) {
    const snapshots = await db.getAll(...unique.slice(index, index + 250).map((value) => db.collection(collectionName).doc(value)));
    for (const snapshot of snapshots) if (snapshot.exists) result.set(snapshot.id, snapshot.data() as Record<string, unknown>);
  }
  return result;
}

export async function getDeliveryControl(reference: string, context: KcplStaffContext) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  const [attemptsSnapshot, evidenceSnapshot] = await Promise.all([
    scope.ref.collection("delivery_attempts").limit(100).get(),
    scope.ref.collection("pod_evidence").limit(250).get(),
  ]);
  const attempts = attemptsSnapshot.docs
    .map((doc) => attemptFromData(doc.id, scope.reference, doc.data() as Record<string, unknown>))
    .sort((a, b) => b.attempt_number - a.attempt_number || b.updated_at.localeCompare(a.updated_at));
  const evidence = evidenceSnapshot.docs
    .map((doc) => evidenceFromData(doc.id, scope.reference, doc.data() as Record<string, unknown>))
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  return {
    kind: "ready" as const,
    reference: scope.reference,
    attempts,
    evidence,
    pod_status: text(scope.data.delivery_pod_status, "not_received") as "not_received" | "received" | "rejected" | "verified",
    pod_document_id: nullable(scope.data.delivery_pod_document_id),
    pod_verified_at: nullable(scope.data.delivery_pod_verified_at),
    pod_verified_by: nullable(scope.data.delivery_pod_verified_by_name),
  };
}

export async function listDeliveryWorkspace(context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const snapshot = await db.collection("shipments").limit(2000).get();
  const accessible = snapshot.docs.filter((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const branches = [...new Set([...(branchValue(data.primary_branch) ? [branchValue(data.primary_branch)!] : []), ...branchList(data.handling_branches)])];
    return context.can_access_all_branches || branches.some((branch) => staffCanAccessBranch(context, branch));
  }).filter((doc) => {
    const status = text(doc.get("status"));
    return status === "out_for_delivery" || status === "delivered" || Number(doc.get("delivery_attempt_count") ?? 0) > 0 || Boolean(doc.get("delivery_pod_status"));
  });

  const quoteIds = accessible.map((doc) => text(doc.get("quote_reference"))).filter(Boolean);
  const customerIds = accessible.map((doc) => nullable(doc.get("customer_id"))).filter((value): value is string => Boolean(value));
  const [quotes, customers] = await Promise.all([loadDocumentsByIds("quotes", quoteIds), loadDocumentsByIds("customers", customerIds)]);
  const rows: DeliveryQueueRow[] = accessible.flatMap((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const primary = branchValue(data.primary_branch) ?? branchList(data.handling_branches)[0];
    if (!primary) return [];
    const quote = quotes.get(text(data.quote_reference)) ?? {};
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) : null;
    const rawAttemptStatus = nullable(data.delivery_last_attempt_status) as DeliveryAttemptStatus | null;
    const attemptStatus = rawAttemptStatus && deliveryAttemptStatuses.includes(rawAttemptStatus) ? rawAttemptStatus : null;
    const podStatus = text(data.delivery_pod_status, "not_received") as "not_received" | "received" | "rejected" | "verified";
    return [{
      reference: doc.id,
      quote_reference: text(data.quote_reference),
      customer_id: customerId,
      customer_name: customer ? text(customer.display_name, "Linked customer") : text(quote.company_name, text(quote.contact_name, "Customer")),
      origin: text(quote.origin, text(data.origin)),
      destination: text(quote.destination, text(data.destination)),
      mode: text(quote.mode, text(data.mode)),
      primary_branch: primary,
      status: text(data.status, "booking_confirmed"),
      delivery_state: deriveDeliveryState({ shipmentStatus: text(data.status), attemptStatus, podStatus }),
      attempt_count: numberOrNull(data.delivery_attempt_count) ?? 0,
      last_attempt_status: attemptStatus,
      last_attempt_at: nullable(data.delivery_last_attempt_at),
      pod_status: podStatus,
      pod_evidence_count: numberOrNull(data.delivery_pod_evidence_count) ?? 0,
      recipient_name: nullable(data.delivery_recipient_name),
      next_delivery_at: nullable(data.delivery_next_at),
      current_location: nullable(data.current_location),
      updated_at: text(data.updated_at),
    }];
  }).sort((a, b) => {
    const score = (row: DeliveryQueueRow) => row.delivery_state === "delivery_failed" ? 100 : row.delivery_state === "delivered_pod_pending" ? 80 : row.delivery_state === "delivery_active" ? 50 : row.delivery_state === "not_started" ? 20 : 0;
    return score(b) - score(a) || b.updated_at.localeCompare(a.updated_at);
  });
  return { kind: "ready" as const, rows, summary: summarizeDelivery(rows), generated_at: new Date().toISOString() };
}

export async function createDeliveryAttempt(reference: string, input: CreateAttemptInput, actor: Actor, context: KcplStaffContext) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  const scheduledFor = validIso(input.scheduledFor);
  if (!deliveryOutcomeValid("scheduled", { scheduledFor: scheduledFor ?? "" })) return { kind: "schedule_required" as const };
  if (text(scope.data.status) === "delivered" || text(scope.data.delivery_pod_status) === "verified") return { kind: "already_delivered" as const };
  const now = new Date().toISOString();
  const attemptNumber = Math.max(0, numberOrNull(scope.data.delivery_attempt_count) ?? 0) + 1;
  const attemptRef = scope.ref.collection("delivery_attempts").doc(id("attempt"));
  const data = {
    attempt_number: attemptNumber,
    status: "scheduled" as const,
    scheduled_for: scheduledFor,
    event_time: null,
    location: input.location.trim() || null,
    latitude: null,
    longitude: null,
    recipient_name: null,
    recipient_phone: null,
    recipient_relation: null,
    driver_name: input.driverName.trim() || null,
    driver_phone: input.driverPhone.trim() || null,
    vehicle_reference: input.vehicleReference.trim() || null,
    failure_reason: null,
    notes: input.notes.trim() || null,
    created_at: now,
    created_by_name: actor.name || null,
    created_by_email: actor.email || null,
    updated_at: now,
    updated_by_name: actor.name || null,
    updated_by_email: actor.email || null,
  };
  const batch = firebaseAdminDb().batch();
  batch.set(attemptRef, data);
  batch.update(scope.ref, {
    delivery_attempt_count: attemptNumber,
    delivery_last_attempt_status: "scheduled",
    delivery_last_attempt_at: now,
    delivery_next_at: scheduledFor,
    delivery_state: "delivery_active",
    updated_at: now,
  });
  batch.set(scope.ref.collection("job_activity").doc(), {
    type: "delivery_attempt_scheduled",
    title: `Delivery attempt ${attemptNumber} scheduled`,
    detail: [scheduledFor ? `Scheduled ${scheduledFor}` : null, input.location, input.driverName || input.vehicleReference].filter(Boolean).join(" · ") || null,
    branch: scope.primary,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
    delivery_attempt_id: attemptRef.id,
  });
  await batch.commit();
  return { kind: "created" as const, attempt: attemptFromData(attemptRef.id, scope.reference, data) };
}

function milestoneForDelivery(status: DeliveryAttemptStatus) {
  if (status === "out_for_delivery") return "out_for_delivery";
  if (status === "delivered") return "delivered";
  if (status === "refused") return "delivery_refused";
  return "delivery_attempted";
}

function shipmentStatusForDelivery(status: DeliveryAttemptStatus, current: string) {
  if (status === "delivered") return "delivered";
  if (status === "refused") return "exception";
  if (status === "out_for_delivery" || status === "failed") return "out_for_delivery";
  return current || "out_for_delivery";
}

export async function updateDeliveryAttempt(reference: string, attemptId: string, input: UpdateAttemptInput, actor: Actor, context: KcplStaffContext) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  if (!deliveryAttemptStatuses.includes(input.status) || input.status === "scheduled") return { kind: "invalid_status" as const };
  const eventTime = validIso(input.eventTime) ?? new Date().toISOString();
  if (!deliveryOutcomeValid(input.status, { recipientName: input.recipientName, failureReason: input.failureReason })) return { kind: "outcome_detail_required" as const };
  if (input.latitude !== null && (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)) return { kind: "invalid_coordinates" as const };
  if (input.longitude !== null && (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)) return { kind: "invalid_coordinates" as const };

  const db = firebaseAdminDb();
  const attemptRef = scope.ref.collection("delivery_attempts").doc(attemptId.trim());
  const now = new Date().toISOString();
  const result = await db.runTransaction(async (transaction) => {
    const [shipmentSnapshot, attemptSnapshot] = await Promise.all([transaction.get(scope.ref), transaction.get(attemptRef)]);
    if (!attemptSnapshot.exists) return { kind: "missing_attempt" as const };
    const attempt = attemptFromData(attemptSnapshot.id, scope.reference, attemptSnapshot.data() as Record<string, unknown>);
    if (!deliveryAttemptTransitionAllowed(attempt.status, input.status)) return { kind: "invalid_transition" as const };
    const shipment = shipmentSnapshot.data() as Record<string, unknown>;
    const currentShipmentStatus = text(shipment.status, "out_for_delivery");
    if (currentShipmentStatus === "delivered" && input.status !== "delivered") return { kind: "already_delivered" as const };

    const customerId = nullable(shipment.customer_id);
    const customerRef = customerId ? db.collection("customers").doc(customerId) : null;
    const customerSnapshot = customerRef && input.status === "delivered" && currentShipmentStatus !== "delivered" ? await transaction.get(customerRef) : null;
    const trackingId = id("delivery-track");
    const legacyId = numericId();
    const nextShipmentStatus = shipmentStatusForDelivery(input.status, currentShipmentStatus);
    const milestone = milestoneForDelivery(input.status);
    const location = input.location.trim() || attempt.location || nullable(shipment.current_location);
    const detail = input.status === "delivered"
      ? `Received by ${input.recipientName.trim()}${input.recipientRelation.trim() ? ` (${input.recipientRelation.trim()})` : ""}.`
      : input.status === "failed" || input.status === "refused"
        ? input.failureReason.trim()
        : input.notes.trim() || null;

    transaction.update(attemptRef, {
      status: input.status,
      event_time: eventTime,
      location,
      latitude: input.latitude,
      longitude: input.longitude,
      recipient_name: input.recipientName.trim() || null,
      recipient_phone: input.recipientPhone.trim() || null,
      recipient_relation: input.recipientRelation.trim() || null,
      failure_reason: input.failureReason.trim() || null,
      notes: input.notes.trim() || attempt.notes || null,
      updated_at: now,
      updated_by_name: actor.name || null,
      updated_by_email: actor.email || null,
    });

    transaction.set(scope.ref.collection("tracking_events").doc(trackingId), {
      shipment_reference: scope.reference,
      milestone,
      title: input.status === "failed" ? "Delivery attempt failed" : input.status === "refused" ? "Delivery refused" : input.status === "delivered" ? "Delivered" : "Out for delivery",
      raw_status: input.status.replaceAll("_", " "),
      location,
      latitude: input.latitude,
      longitude: input.longitude,
      event_time: eventTime,
      received_at: now,
      source: "manual",
      provider: "KCPL Delivery Control",
      provider_event_id: null,
      details: detail,
      eta: null,
      confidence: 1,
      actor_name: actor.name || null,
      actor_email: actor.email || null,
    });
    transaction.set(scope.ref.collection("events").doc(String(legacyId)), {
      id: legacyId,
      shipment_reference: scope.reference,
      title: input.status === "failed" ? "Delivery attempt failed" : input.status === "refused" ? "Delivery refused" : input.status === "delivered" ? "Delivered" : "Out for delivery",
      location,
      details: detail,
      event_time: eventTime,
      created_at: now,
      author_name: actor.name || "KCPL Delivery Control",
    });
    transaction.set(scope.ref.collection("job_activity").doc(), {
      type: `delivery_${input.status}`,
      title: input.status === "delivered" ? `Delivery attempt ${attempt.attempt_number} completed` : input.status === "refused" ? `Delivery attempt ${attempt.attempt_number} refused` : input.status === "failed" ? `Delivery attempt ${attempt.attempt_number} failed` : `Delivery attempt ${attempt.attempt_number} dispatched`,
      detail,
      branch: scope.primary,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
      delivery_attempt_id: attemptRef.id,
    });

    const podStatus = text(shipment.delivery_pod_status, "not_received");
    transaction.update(scope.ref, {
      status: nextShipmentStatus,
      current_location: location,
      delivery_last_attempt_status: input.status,
      delivery_last_attempt_at: eventTime,
      delivery_next_at: null,
      delivery_recipient_name: input.recipientName.trim() || nullable(shipment.delivery_recipient_name),
      delivery_state: input.status === "delivered" ? (podStatus === "verified" ? "pod_verified" : "delivered_pod_pending") : input.status === "failed" || input.status === "refused" ? "delivery_failed" : "delivery_active",
      ...(input.status === "delivered" && podStatus !== "verified" ? { delivery_pod_status: podStatus === "rejected" ? "rejected" : "not_received" } : {}),
      tracking_last_event_at: eventTime,
      tracking_last_received_at: now,
      tracking_last_milestone: milestone,
      tracking_last_source: "manual",
      tracking_last_provider: "KCPL Delivery Control",
      updated_at: now,
    });

    if (customerRef && customerSnapshot?.exists) {
      const active = Number(customerSnapshot.get("active_shipment_count") ?? 0);
      const completed = Number(customerSnapshot.get("completed_shipment_count") ?? 0);
      transaction.update(customerRef, {
        active_shipment_count: Math.max(0, active - 1),
        completed_shipment_count: completed + 1,
        updated_at: now,
      });
      transaction.create(customerRef.collection("activity").doc(id("delivery")), {
        type: "shipment_delivered",
        title: `${scope.reference}: Delivered`,
        detail: detail,
        actor_name: actor.name || "KCPL Delivery Control",
        actor_email: actor.email || null,
        created_at: now,
      });
    }

    if (input.status === "failed" || input.status === "refused") {
      const exceptionRef = scope.ref.collection("exceptions").doc(`delivery-${attemptRef.id}`);
      const existingException = await transaction.get(exceptionRef);
      if (!existingException.exists) {
        const severity = input.status === "refused" ? "high" : "medium";
        const slaHours = severity === "high" ? 6 : 24;
        transaction.set(exceptionRef, {
          category: input.status === "refused" ? "delivery_refusal" : "delay",
          severity,
          status: "open",
          title: input.status === "refused" ? "Consignee refused delivery" : "Delivery attempt failed",
          detail,
          operational_impact: detail,
          branch: scope.primary,
          assigned_to_name: null,
          assigned_to_email: null,
          sla_due_at: new Date(Date.parse(now) + slaHours * 3_600_000).toISOString(),
          opened_at: now,
          opened_by_name: "KCPL Delivery Control",
          opened_by_email: "delivery@kcpl.internal",
          updated_at: now,
          updated_by_name: actor.name || "KCPL Delivery Control",
          updated_by_email: actor.email || "delivery@kcpl.internal",
          resolved_at: null,
          resolved_by_name: null,
          resolved_by_email: null,
          resolution: null,
          delivery_attempt_id: attemptRef.id,
          source: "delivery_control",
        });
      }
    }
    return { kind: "updated" as const };
  });
  if (result.kind !== "updated") return result;
  const refreshed = await attemptRef.get();
  return { kind: "updated" as const, attempt: attemptFromData(refreshed.id, scope.reference, refreshed.data() as Record<string, unknown>) };
}

export async function uploadPodEvidence(
  reference: string,
  attemptId: string,
  kind: PodEvidenceKind,
  file: File,
  capturedAt: string,
  actor: Actor,
  context: KcplStaffContext,
) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  if (!firebaseStorageBucketName()) return { kind: "storage_unavailable" as const };
  if (!podEvidenceKinds.includes(kind)) return { kind: "invalid_kind" as const };
  if (!podFileAccepted(file.type, file.size)) return { kind: "invalid_file" as const };
  const attemptRef = scope.ref.collection("delivery_attempts").doc(attemptId.trim());
  const attemptSnapshot = await attemptRef.get();
  if (!attemptSnapshot.exists) return { kind: "missing_attempt" as const };
  const attempt = attemptFromData(attemptSnapshot.id, scope.reference, attemptSnapshot.data() as Record<string, unknown>);
  if (attempt.status !== "delivered") return { kind: "delivery_required" as const };
  if (text(scope.data.delivery_pod_status) === "verified") return { kind: "already_verified" as const };

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const evidenceId = id("pod");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140) || `pod-${evidenceId}`;
  const storagePath = `shipments/${scope.reference}/pod/evidence/${evidenceId}/${safeName}`;
  const bucketFile = firebaseAdminBucket().file(storagePath);
  await bucketFile.save(bytes, {
    resumable: false,
    contentType: file.type,
    metadata: { cacheControl: "private, max-age=0, no-store", metadata: { shipmentReference: scope.reference, deliveryAttemptId: attempt.id, evidenceId, sha256 } },
  });

  const now = new Date().toISOString();
  const data = {
    attempt_id: attempt.id,
    kind,
    filename: safeName,
    content_type: file.type,
    size_bytes: file.size,
    sha256,
    storage_path: storagePath,
    review_status: "received" as const,
    customer_safe: false,
    captured_at: validIso(capturedAt) ?? now,
    uploaded_at: now,
    uploaded_by_name: actor.name || null,
    uploaded_by_email: actor.email || null,
    reviewed_at: null,
    reviewed_by_name: null,
    reviewed_by_email: null,
    review_note: null,
  };
  try {
    const batch = firebaseAdminDb().batch();
    batch.set(scope.ref.collection("pod_evidence").doc(evidenceId), data);
    batch.update(scope.ref, {
      delivery_pod_status: "received",
      delivery_pod_evidence_count: (numberOrNull(scope.data.delivery_pod_evidence_count) ?? 0) + 1,
      delivery_state: "delivered_pod_pending",
      updated_at: now,
    });
    batch.set(scope.ref.collection("job_activity").doc(), {
      type: "pod_evidence_uploaded",
      title: `POD ${kind} uploaded`,
      detail: `${safeName} · SHA-256 ${sha256.slice(0, 12)}…`,
      branch: scope.primary,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
      delivery_attempt_id: attempt.id,
      pod_evidence_id: evidenceId,
    });
    await batch.commit();
  } catch (error) {
    await bucketFile.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
  return { kind: "created" as const, evidence: evidenceFromData(evidenceId, scope.reference, data) };
}

export async function reviewPod(
  reference: string,
  attemptId: string,
  decision: "verify" | "reject",
  note: string,
  customerSafe: boolean,
  actor: Actor,
  context: KcplStaffContext,
) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  if (text(scope.data.delivery_pod_status) === "verified") return { kind: "already_verified" as const };
  const attemptRef = scope.ref.collection("delivery_attempts").doc(attemptId.trim());
  const [attemptSnapshot, evidenceSnapshot] = await Promise.all([
    attemptRef.get(),
    scope.ref.collection("pod_evidence").where("attempt_id", "==", attemptId.trim()).limit(100).get(),
  ]);
  if (!attemptSnapshot.exists) return { kind: "missing_attempt" as const };
  const attempt = attemptFromData(attemptSnapshot.id, scope.reference, attemptSnapshot.data() as Record<string, unknown>);
  if (attempt.status !== "delivered") return { kind: "delivery_required" as const };
  const evidence = evidenceSnapshot.docs.map((doc) => evidenceFromData(doc.id, scope.reference, doc.data() as Record<string, unknown>));
  if (!evidence.length) return { kind: "evidence_required" as const };
  if (decision === "reject" && note.trim().length < 8) return { kind: "review_note_required" as const };
  const now = new Date().toISOString();
  const db = firebaseAdminDb();
  const batch = db.batch();

  if (decision === "reject") {
    for (const doc of evidenceSnapshot.docs) batch.update(doc.ref, { review_status: "rejected", customer_safe: false, reviewed_at: now, reviewed_by_name: actor.name || null, reviewed_by_email: actor.email || null, review_note: note.trim() });
    batch.update(scope.ref, { delivery_pod_status: "rejected", delivery_state: "delivered_pod_pending", updated_at: now });
    batch.set(scope.ref.collection("job_activity").doc(), {
      type: "pod_rejected",
      title: "Proof of Delivery rejected",
      detail: note.trim(),
      branch: scope.primary,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
      delivery_attempt_id: attempt.id,
    });
    await batch.commit();
    return { kind: "rejected" as const };
  }

  if (!firebaseStorageBucketName()) return { kind: "storage_unavailable" as const };
  const manifest = {
    version: 1,
    shipmentReference: scope.reference,
    deliveryAttempt: {
      id: attempt.id,
      attemptNumber: attempt.attempt_number,
      deliveredAt: attempt.event_time,
      location: attempt.location,
      coordinates: attempt.latitude !== null && attempt.longitude !== null ? { latitude: attempt.latitude, longitude: attempt.longitude } : null,
      recipientName: attempt.recipient_name,
      recipientPhone: attempt.recipient_phone,
      recipientRelation: attempt.recipient_relation,
      driverName: attempt.driver_name,
      vehicleReference: attempt.vehicle_reference,
    },
    evidence: evidence.map((item) => ({ id: item.id, kind: item.kind, filename: item.filename, contentType: item.content_type, sizeBytes: item.size_bytes, sha256: item.sha256, capturedAt: item.captured_at })),
    verifiedAt: now,
    verifiedBy: { name: actor.name || null, email: actor.email || null },
    reviewNote: note.trim() || null,
    customerSafe,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");
  const manifestId = id("pod-manifest");
  const manifestPath = `shipments/${scope.reference}/pod/manifests/${manifestId}.json`;
  const manifestFile = firebaseAdminBucket().file(manifestPath);
  await manifestFile.save(manifestBytes, { resumable: false, contentType: "application/json", metadata: { cacheControl: "private, max-age=0, no-store", metadata: { shipmentReference: scope.reference, deliveryAttemptId: attempt.id, sha256: manifestHash } } });

  const documentId = numericId();
  const documentRef = scope.ref.collection("documents").doc(String(documentId));
  try {
    for (const doc of evidenceSnapshot.docs) batch.update(doc.ref, { review_status: "verified", customer_safe: customerSafe, reviewed_at: now, reviewed_by_name: actor.name || null, reviewed_by_email: actor.email || null, review_note: note.trim() || null });
    batch.set(documentRef, {
      id: documentId,
      shipment_reference: scope.reference,
      filename: `POD-${scope.reference}-attempt-${attempt.attempt_number}.json`,
      content_type: "application/json",
      size_bytes: manifestBytes.length,
      document_type: "proof_of_delivery",
      storage_path: manifestPath,
      uploaded_at: now,
      uploaded_by: "KCPL Delivery Control",
      uploaded_by_email: actor.email || null,
      review_status: "verified",
      customer_safe: customerSafe,
      review_note: note.trim() || null,
      reviewed_at: now,
      reviewed_by: actor.name || null,
      reviewed_by_email: actor.email || null,
      verified_at: now,
      verified_by: actor.name || null,
      verified_by_email: actor.email || null,
      expires_on: null,
      supersedes_document_id: null,
      superseded_by_document_id: null,
      deleted_at: null,
      deleted_by: null,
      deleted_by_email: null,
      sha256: manifestHash,
      delivery_attempt_id: attempt.id,
      pod_manifest: true,
    });
    batch.update(scope.ref, {
      delivery_pod_status: "verified",
      delivery_pod_document_id: String(documentId),
      delivery_pod_verified_at: now,
      delivery_pod_verified_by_name: actor.name || null,
      delivery_pod_verified_by_email: actor.email || null,
      delivery_state: "pod_verified",
      updated_at: now,
    });
    batch.set(scope.ref.collection("job_activity").doc(), {
      type: "pod_verified",
      title: "Proof of Delivery verified",
      detail: `${evidence.length} evidence item${evidence.length === 1 ? "" : "s"} sealed into POD manifest · SHA-256 ${manifestHash.slice(0, 12)}…`,
      branch: scope.primary,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
      delivery_attempt_id: attempt.id,
      document_id: documentId,
    });
    await batch.commit();
  } catch (error) {
    await manifestFile.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
  return { kind: "verified" as const, document_id: String(documentId), sha256: manifestHash };
}

export async function podEvidenceDownload(reference: string, evidenceId: string, context: KcplStaffContext) {
  const scope = await shipmentScope(reference, context);
  if (scope.kind !== "ready") return scope;
  const snapshot = await scope.ref.collection("pod_evidence").doc(evidenceId.trim()).get();
  if (!snapshot.exists) return { kind: "missing_evidence" as const };
  const storagePath = nullable(snapshot.get("storage_path"));
  if (!storagePath || !firebaseStorageBucketName()) return { kind: "storage_unavailable" as const };
  const [url] = await firebaseAdminBucket().file(storagePath).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60_000 });
  return { kind: "ready" as const, url };
}
