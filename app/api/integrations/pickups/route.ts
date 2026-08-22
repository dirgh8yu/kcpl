import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../../../admin/crm/crm-data";
import { pickupAppointmentStatuses, pickupChannels, pickupTransitionAllowed, validAppointmentWindow, type PickupChannel, type PickupAppointmentStatus } from "../../../admin/pickups/pickup-appointments";
import { recordTrackingEvent } from "../../../admin/visibility/tracking-visibility.server";
import { pickupMachineAuthorized } from "../../../machine-auth-policy";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function nullable(value: unknown) { const output = clean(value, 500); return output || null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function validIso(value: unknown) { const candidate = clean(value, 80); const parsed = Date.parse(candidate); return candidate && Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }
function appointmentId(reference: string) { return `PU-${reference.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 180); }
function eventDocId(provider: string, providerEventId: string) { return createHash("sha256").update(`${provider}\n${providerEventId}`).digest("hex"); }
function appointmentStatus(value: unknown): PickupAppointmentStatus { const candidate = clean(value, 40) as PickupAppointmentStatus; return pickupAppointmentStatuses.includes(candidate) ? candidate : "unscheduled"; }

export const pickupIntegrationAuthorized = pickupMachineAuthorized;

async function loadReferenceData(shipment: Record<string, unknown>) {
  const db = firebaseAdminDb();
  const quoteId = nullable(shipment.quote_reference);
  const customerId = nullable(shipment.customer_id);
  const tenderId = nullable(shipment.tender_id);
  const [quote, customer, tender] = await Promise.all([
    quoteId ? db.collection("quotes").doc(quoteId).get() : null,
    customerId ? db.collection("customers").doc(customerId).get() : null,
    tenderId ? db.collection("transport_tenders").doc(tenderId).get() : null,
  ]);
  return {
    quote: quote?.exists ? quote.data() as Record<string, unknown> : {},
    customer: customer?.exists ? customer.data() as Record<string, unknown> : {},
    tender: tender?.exists ? tender.data() as Record<string, unknown> : {},
  };
}

async function recordPickupObservation(input: {
  reference: string;
  action: string;
  channel: PickupChannel;
  location: string;
  eventTime: string;
  provider: string;
  providerEventId: string;
  requestedStart: string | null;
  requestedEnd: string | null;
  reason: string;
  appointmentId: string;
}) {
  const source = input.channel === "edi" ? "edi_214" : input.channel === "carrier_api" ? "carrier_api" : "webhook";
  if (input.action === "request" || input.action === "confirm") {
    return recordTrackingEvent(input.reference, {
      source,
      rawStatus: "Pickup scheduled",
      milestone: "pickup_scheduled",
      location: input.location,
      eta: "",
      eventTime: input.eventTime,
      provider: input.provider,
      providerEventId: input.providerEventId,
      details: `${input.action === "confirm" ? "Confirmed" : "Requested"} pickup window ${input.requestedStart} to ${input.requestedEnd}.`,
    }, { name: input.provider, email: "pickup-integration@kcpl.internal" });
  }
  if (input.action === "picked_up") {
    return recordTrackingEvent(input.reference, {
      source,
      rawStatus: "Picked up",
      milestone: "picked_up",
      location: input.location,
      eta: "",
      eventTime: input.eventTime,
      provider: input.provider,
      providerEventId: input.providerEventId,
      details: input.reason || `Pickup appointment ${input.appointmentId} completed.`,
    }, { name: input.provider, email: "pickup-integration@kcpl.internal" });
  }
  if (input.action === "missed") {
    return recordTrackingEvent(input.reference, {
      source,
      rawStatus: "Pickup missed - carrier exception",
      milestone: "exception",
      location: input.location,
      eta: "",
      eventTime: input.eventTime,
      provider: input.provider,
      providerEventId: input.providerEventId,
      details: input.reason,
    }, { name: input.provider, email: "pickup-integration@kcpl.internal" });
  }
  return null;
}

export async function POST(request: Request) {
  const auth = pickupIntegrationAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Firebase pickup storage is unavailable." }, 503);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The pickup integration payload could not be read." }, 400); }

  const reference = clean(body.reference, 180).toUpperCase();
  const action = clean(body.action, 40) || "confirm";
  const provider = clean(body.provider, 180) || "External pickup provider";
  const providerEventId = clean(body.providerEventId ?? body.provider_event_id, 240);
  if (!reference) return json({ ok: false, error: "reference is required." }, 400);
  if (!providerEventId) return json({ ok: false, error: "providerEventId is required for idempotency." }, 400);
  if (!["request", "confirm", "assign_driver", "picked_up", "missed", "cancel"].includes(action)) return json({ ok: false, error: "Choose a valid pickup integration action." }, 400);

  const db = firebaseAdminDb();
  const shipmentRef = db.collection("shipments").doc(reference);
  const shipmentSnapshot = await shipmentRef.get();
  if (!shipmentSnapshot.exists) return json({ ok: false, error: "Shipment not found." }, 404);
  const shipment = shipmentSnapshot.data() as Record<string, unknown>;
  const branch = branchValue(shipment.primary_branch);
  if (!branch) return json({ ok: false, error: "Shipment does not have a canonical KCPL primary branch." }, 409);

  const id = appointmentId(reference);
  const eventKey = eventDocId(provider, providerEventId);
  const appointmentRef = db.collection("pickup_appointments").doc(id);
  const integrationEventRef = appointmentRef.collection("provider_events").doc(eventKey);
  const [appointmentSnapshot, source] = await Promise.all([appointmentRef.get(), loadReferenceData(shipment)]);
  const appointment = appointmentSnapshot.exists ? appointmentSnapshot.data() as Record<string, unknown> : {};
  const currentStatus = appointmentStatus(appointment.status);

  const now = new Date().toISOString();
  const requestedStart = validIso(body.windowStart ?? body.window_start);
  const requestedEnd = validIso(body.windowEnd ?? body.window_end);
  if ((action === "request" || action === "confirm") && !validAppointmentWindow(requestedStart, requestedEnd)) return json({ ok: false, error: "A valid pickup window is required." }, 400);
  const channelText = clean(body.channel, 40) as PickupChannel;
  const channel: PickupChannel = pickupChannels.includes(channelText) && channelText !== "manual" ? channelText : "carrier_api";
  const location = clean(body.pickupLocation ?? body.location, 500) || clean(appointment.pickup_location, 500) || clean(source.quote.origin, 500) || clean(shipment.origin, 500);
  const providerReference = clean(body.providerReference ?? body.provider_reference, 180) || clean(appointment.provider_reference, 180);
  const driverName = clean(body.driverName ?? body.driver_name, 180);
  const driverPhone = clean(body.driverPhone ?? body.driver_phone, 100);
  const vehicleReference = clean(body.vehicleReference ?? body.vehicle_reference, 180);
  const reason = clean(body.reason ?? body.details, 2000);
  const eventTime = validIso(body.eventTime ?? body.event_time) ?? now;

  const base = {
    shipment_reference: reference,
    transport_order_id: nullable(shipment.transport_order_id),
    tender_id: nullable(shipment.tender_id),
    booking_reference: nullable(shipment.booking_reference) ?? nullable(source.tender.booking_reference),
    branch,
    customer_id: nullable(shipment.customer_id),
    customer_name: clean(source.customer.display_name, 300) || clean(source.quote.company_name, 300) || clean(source.quote.contact_name, 300) || "Customer",
    partner_id: nullable(source.tender.partner_id),
    partner_name: nullable(source.tender.partner_name) ?? nullable(shipment.carrier) ?? provider,
    origin: clean(source.quote.origin, 300) || clean(shipment.origin, 300),
    destination: clean(source.quote.destination, 300) || clean(shipment.destination, 300),
    channel,
    pickup_location: location || null,
    contact_name: nullable(body.contactName ?? body.contact_name) ?? nullable(appointment.contact_name),
    contact_phone: nullable(body.contactPhone ?? body.contact_phone) ?? nullable(appointment.contact_phone),
    provider_reference: providerReference || null,
    created_at: nullable(appointment.created_at) ?? now,
    updated_at: now,
    updated_by_name: provider,
    updated_by_email: "pickup-integration@kcpl.internal",
  };

  const update: Record<string, unknown> = { ...base };
  let nextStatus: PickupAppointmentStatus = currentStatus;
  if (action === "request") {
    nextStatus = "requested";
    Object.assign(update, { status: nextStatus, requested_window_start: requestedStart, requested_window_end: requestedEnd, attempt_count: Math.max(1, Number(appointment.attempt_count ?? 0) + (currentStatus === "missed" ? 1 : appointmentSnapshot.exists ? 0 : 1)), missed_at: null, missed_reason: null });
  } else if (action === "confirm") {
    nextStatus = "confirmed";
    Object.assign(update, { status: nextStatus, requested_window_start: validIso(appointment.requested_window_start) ?? requestedStart, requested_window_end: validIso(appointment.requested_window_end) ?? requestedEnd, confirmed_window_start: requestedStart, confirmed_window_end: requestedEnd, attempt_count: Math.max(1, Number(appointment.attempt_count ?? 0) || 1), missed_at: null, missed_reason: null });
  } else if (action === "assign_driver") {
    if (!driverName) return json({ ok: false, error: "driverName is required." }, 400);
    if (!appointmentSnapshot.exists) return json({ ok: false, error: "A pickup appointment must exist before driver assignment." }, 409);
    nextStatus = "driver_assigned";
    Object.assign(update, { status: nextStatus, driver_name: driverName, driver_phone: driverPhone || null, vehicle_reference: vehicleReference || null });
  } else if (action === "picked_up") {
    if (!appointmentSnapshot.exists) return json({ ok: false, error: "A pickup appointment must exist before completion." }, 409);
    nextStatus = "picked_up";
    Object.assign(update, { status: nextStatus, picked_up_at: eventTime, missed_at: null, missed_reason: null });
  } else if (action === "missed") {
    if (!appointmentSnapshot.exists) return json({ ok: false, error: "A pickup appointment must exist before a missed pickup can be reported." }, 409);
    if (reason.length < 6) return json({ ok: false, error: "A missed-pickup reason is required." }, 400);
    nextStatus = "missed";
    Object.assign(update, { status: nextStatus, missed_at: eventTime, missed_reason: reason });
  } else {
    if (!appointmentSnapshot.exists) return json({ ok: false, error: "Pickup appointment not found." }, 404);
    nextStatus = "cancelled";
    Object.assign(update, { status: nextStatus, notes: reason || nullable(appointment.notes) });
  }

  const observationInput = { reference, action, channel, location, eventTime, provider, providerEventId, requestedStart, requestedEnd, reason, appointmentId: id };
  if (!pickupTransitionAllowed(currentStatus, nextStatus)) {
    await recordPickupObservation(observationInput);
    return json({ ok: false, error: `Provider observation cannot move pickup from ${currentStatus} to ${nextStatus}; KCPL reconciliation is required.`, reconciliationRequired: true, observationStored: true }, 409);
  }

  const eventTitle = action === "request" ? "Pickup requested by provider" : action === "confirm" ? "Pickup appointment confirmed by provider" : action === "assign_driver" ? "Pickup driver assigned by provider" : action === "picked_up" ? "Cargo picked up" : action === "missed" ? "Pickup missed" : "Pickup cancelled by provider";
  const domainResult = await db.runTransaction(async (transaction) => {
    const [currentShipment, currentAppointment, existingEvent] = await Promise.all([
      transaction.get(shipmentRef),
      transaction.get(appointmentRef),
      transaction.get(integrationEventRef),
    ]);
    if (!currentShipment.exists) return { kind: "missing" as const };
    const transactionBranch = branchValue(currentShipment.get("primary_branch"));
    if (!transactionBranch) return { kind: "invalid_branch" as const };
    if (existingEvent.exists) return { kind: "duplicate" as const };

    const transactionStatus = currentAppointment.exists ? appointmentStatus(currentAppointment.get("status")) : "unscheduled";
    if (transactionStatus !== currentStatus || currentAppointment.exists !== appointmentSnapshot.exists) return { kind: "state_conflict" as const, status: transactionStatus };
    if (!pickupTransitionAllowed(transactionStatus, nextStatus)) return { kind: "invalid_transition" as const, status: transactionStatus };

    transaction.set(appointmentRef, { ...update, branch: transactionBranch }, { merge: true });
    transaction.create(integrationEventRef, {
      provider,
      provider_event_id: providerEventId,
      action,
      received_at: now,
      event_time: eventTime,
      payload_reference: reference,
      observed_status: nextStatus,
      canonical_status_before: transactionStatus,
      canonical_status_after: nextStatus,
      reconciliation_decision: "promote",
      reconciliation_reason: "pickup_transition_policy_satisfied",
      idempotency_fingerprint: eventKey,
    });
    transaction.set(appointmentRef.collection("events").doc(`provider-${eventKey}`), {
      type: `provider_${action}`,
      title: eventTitle,
      detail: reason || providerReference || null,
      actor_name: provider,
      actor_email: "pickup-integration@kcpl.internal",
      created_at: now,
      provider_event_id: providerEventId,
      idempotency_fingerprint: eventKey,
    });
    transaction.set(shipmentRef.collection("job_activity").doc(`pickup-provider-${eventKey}`), {
      type: `pickup_provider_${action}`,
      title: eventTitle,
      detail: reason || providerReference || null,
      branch: transactionBranch,
      actor_name: provider,
      actor_email: "pickup-integration@kcpl.internal",
      created_at: now,
      pickup_appointment_id: id,
      provider_event_id: providerEventId,
      pickup_status_before: transactionStatus,
      pickup_status_after: nextStatus,
      idempotency_fingerprint: eventKey,
    });
    transaction.update(shipmentRef, {
      pickup_appointment_id: id,
      pickup_status: nextStatus,
      pickup_window_start: action === "request" || action === "confirm" ? requestedStart : validIso(currentAppointment.get("confirmed_window_start")) ?? validIso(currentAppointment.get("requested_window_start")),
      pickup_window_end: action === "request" || action === "confirm" ? requestedEnd : validIso(currentAppointment.get("confirmed_window_end")) ?? validIso(currentAppointment.get("requested_window_end")),
      pickup_driver_name: driverName || nullable(currentAppointment.get("driver_name")),
      pickup_vehicle_reference: vehicleReference || nullable(currentAppointment.get("vehicle_reference")),
      pickup_completed_at: action === "picked_up" ? eventTime : nullable(currentShipment.get("pickup_completed_at")),
      updated_at: now,
    });
    return { kind: "updated" as const };
  });

  if (domainResult.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (domainResult.kind === "invalid_branch") return json({ ok: false, error: "Shipment does not have a canonical KCPL primary branch." }, 409);
  if (domainResult.kind === "state_conflict" || domainResult.kind === "invalid_transition") {
    await recordPickupObservation(observationInput);
    return json({ ok: false, error: "Pickup workflow changed concurrently; provider observation was retained for reconciliation.", reconciliationRequired: true, observationStored: true }, 409);
  }

  const trackingResult = await recordPickupObservation(observationInput);
  if (trackingResult && trackingResult.kind === "invalid_branch") return json({ ok: false, error: "Shipment lost its canonical KCPL primary branch before observation reconciliation." }, 409);

  if (domainResult.kind === "duplicate") {
    return json({ ok: true, duplicate: true, reference, pickupAppointmentId: id, trackingReconciled: true });
  }
  return json({ ok: true, reference, pickupAppointmentId: id, status: nextStatus, providerEventId, trackingReconciled: true }, appointmentSnapshot.exists ? 200 : 201);
}
