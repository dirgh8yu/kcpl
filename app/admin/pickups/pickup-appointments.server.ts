import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { recordTrackingEvent } from "../visibility/tracking-visibility.server";
import {
  pickupAppointmentStatuses,
  pickupChannels,
  summarizePickups,
  validAppointmentWindow,
  type PickupAppointment,
  type PickupAppointmentStatus,
  type PickupChannel,
  type PickupQueueRow,
} from "./pickup-appointments";

type Actor = { name: string; email: string };

type ScheduleInput = {
  windowStart: string;
  windowEnd: string;
  pickupLocation: string;
  contactName?: string;
  contactPhone?: string;
  channel: PickupChannel;
  confirmed?: boolean;
  providerReference?: string;
  notes?: string;
};

type ConfirmInput = {
  windowStart: string;
  windowEnd: string;
  providerReference?: string;
  notes?: string;
};

type DriverInput = {
  driverName: string;
  driverPhone?: string;
  vehicleReference?: string;
  notes?: string;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function statusValue(value: unknown): PickupAppointmentStatus { return pickupAppointmentStatuses.includes(value as PickupAppointmentStatus) ? value as PickupAppointmentStatus : "unscheduled"; }
function channelValue(value: unknown): PickupChannel { return pickupChannels.includes(value as PickupChannel) ? value as PickupChannel : "manual"; }
function validIso(value: unknown) { const candidate = text(value); const parsed = Date.parse(candidate); return candidate && Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }
function appointmentId(reference: string) { return `PU-${reference.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 180); }

function appointmentFromData(id: string, data: Record<string, unknown>): PickupAppointment | null {
  const branch = branchValue(data.branch);
  if (!branch) return null;
  return {
    id,
    shipment_reference: text(data.shipment_reference).toUpperCase(),
    transport_order_id: nullable(data.transport_order_id),
    tender_id: nullable(data.tender_id),
    booking_reference: nullable(data.booking_reference),
    branch,
    customer_id: nullable(data.customer_id),
    customer_name: text(data.customer_name, "Customer"),
    partner_id: nullable(data.partner_id),
    partner_name: nullable(data.partner_name),
    origin: text(data.origin),
    destination: text(data.destination),
    status: statusValue(data.status),
    channel: channelValue(data.channel),
    requested_window_start: validIso(data.requested_window_start),
    requested_window_end: validIso(data.requested_window_end),
    confirmed_window_start: validIso(data.confirmed_window_start),
    confirmed_window_end: validIso(data.confirmed_window_end),
    pickup_location: nullable(data.pickup_location),
    contact_name: nullable(data.contact_name),
    contact_phone: nullable(data.contact_phone),
    provider_reference: nullable(data.provider_reference),
    driver_name: nullable(data.driver_name),
    driver_phone: nullable(data.driver_phone),
    vehicle_reference: nullable(data.vehicle_reference),
    attempt_count: Math.max(0, numberValue(data.attempt_count)),
    picked_up_at: validIso(data.picked_up_at),
    missed_at: validIso(data.missed_at),
    missed_reason: nullable(data.missed_reason),
    notes: nullable(data.notes),
    created_at: validIso(data.created_at),
    updated_at: validIso(data.updated_at) ?? new Date(0).toISOString(),
  };
}

async function loadMap(collection: string, ids: string[]) {
  const db = firebaseAdminDb();
  const unique = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const map = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < unique.length; index += 250) {
    const snapshots = await db.getAll(...unique.slice(index, index + 250).map((id) => db.collection(collection).doc(id)));
    for (const snapshot of snapshots) if (snapshot.exists) map.set(snapshot.id, snapshot.data() as Record<string, unknown>);
  }
  return map;
}

async function shipmentScope(reference: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const id = reference.trim().toUpperCase();
  if (!id) return { kind: "missing" as const };
  const ref = firebaseAdminDb().collection("shipments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const branch = branchValue(data.primary_branch) ?? branchValue(Array.isArray(data.handling_branches) ? data.handling_branches[0] : null);
  if (!branch) return { kind: "missing_branch" as const };
  if (!staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
  return { kind: "ready" as const, id, ref, snapshot, data, branch };
}

async function sourceSnapshots(shipment: Record<string, unknown>) {
  const db = firebaseAdminDb();
  const tenderId = nullable(shipment.tender_id);
  const customerId = nullable(shipment.customer_id);
  const quoteId = nullable(shipment.quote_reference);
  const [tender, customer, quote] = await Promise.all([
    tenderId ? db.collection("transport_tenders").doc(tenderId).get() : null,
    customerId ? db.collection("customers").doc(customerId).get() : null,
    quoteId ? db.collection("quotes").doc(quoteId).get() : null,
  ]);
  return {
    tender: tender?.exists ? tender.data() as Record<string, unknown> : {},
    customer: customer?.exists ? customer.data() as Record<string, unknown> : {},
    quote: quote?.exists ? quote.data() as Record<string, unknown> : {},
  };
}

export async function listPickupWorkspace(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, appointmentsSnapshot] = await Promise.all([
    db.collection("shipments").orderBy("updated_at", "desc").limit(2000).get(),
    db.collection("pickup_appointments").orderBy("updated_at", "desc").limit(2000).get(),
  ]);
  const appointments = new Map<string, PickupAppointment>();
  for (const doc of appointmentsSnapshot.docs) {
    const appointment = appointmentFromData(doc.id, doc.data() as Record<string, unknown>);
    if (appointment) appointments.set(appointment.shipment_reference, appointment);
  }

  const accessible = shipmentsSnapshot.docs.filter((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const branch = branchValue(data.primary_branch) ?? branchValue(Array.isArray(data.handling_branches) ? data.handling_branches[0] : null);
    if (!branch || !staffCanAccessBranch(staff, branch)) return false;
    const status = text(data.status);
    if (status === "delivered" || status === "cancelled") return false;
    return Boolean(nullable(data.booking_reference) || nullable(data.tender_id) || nullable(data.transport_order_id));
  });

  const customerIds = accessible.map((doc) => nullable(doc.get("customer_id"))).filter((value): value is string => Boolean(value));
  const quoteIds = accessible.map((doc) => nullable(doc.get("quote_reference"))).filter((value): value is string => Boolean(value));
  const tenderIds = accessible.map((doc) => nullable(doc.get("tender_id"))).filter((value): value is string => Boolean(value));
  const [customers, quotes, tenders] = await Promise.all([loadMap("customers", customerIds), loadMap("quotes", quoteIds), loadMap("transport_tenders", tenderIds)]);
  const now = new Date().toISOString();
  const rows: PickupQueueRow[] = accessible.flatMap((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const branch = branchValue(data.primary_branch) ?? branchValue(Array.isArray(data.handling_branches) ? data.handling_branches[0] : null);
    if (!branch) return [];
    const existing = appointments.get(doc.id);
    if (existing) return [{ ...existing, shipment_status: text(data.status, "booking_confirmed"), current_location: nullable(data.current_location) }];
    const customerId = nullable(data.customer_id);
    const quote = quotes.get(text(data.quote_reference)) ?? {};
    const customer = customerId ? customers.get(customerId) ?? {} : {};
    const tenderId = nullable(data.tender_id);
    const tender = tenderId ? tenders.get(tenderId) ?? {} : {};
    return [{
      id: appointmentId(doc.id),
      shipment_reference: doc.id,
      transport_order_id: nullable(data.transport_order_id),
      tender_id: tenderId,
      booking_reference: nullable(data.booking_reference) ?? nullable(tender.booking_reference),
      branch,
      customer_id: customerId,
      customer_name: text(customer.display_name, text(quote.company_name, text(quote.contact_name, "Customer"))),
      partner_id: nullable(tender.partner_id),
      partner_name: nullable(tender.partner_name) ?? nullable(data.carrier),
      origin: text(quote.origin, text(data.origin)),
      destination: text(quote.destination, text(data.destination)),
      status: "unscheduled",
      channel: "manual",
      requested_window_start: null,
      requested_window_end: null,
      confirmed_window_start: null,
      confirmed_window_end: null,
      pickup_location: text(quote.origin, text(data.origin)) || null,
      contact_name: null,
      contact_phone: null,
      provider_reference: null,
      driver_name: null,
      driver_phone: null,
      vehicle_reference: null,
      attempt_count: 0,
      picked_up_at: null,
      missed_at: null,
      missed_reason: null,
      notes: null,
      created_at: null,
      updated_at: text(data.updated_at, now),
      shipment_status: text(data.status, "booking_confirmed"),
      current_location: nullable(data.current_location),
    }];
  }).sort((a, b) => {
    const rank = (row: PickupQueueRow) => row.status === "missed" ? 100 : row.status === "unscheduled" ? 80 : row.status === "requested" ? 60 : row.status === "confirmed" || row.status === "driver_assigned" ? 40 : 0;
    return rank(b) - rank(a) || b.updated_at.localeCompare(a.updated_at);
  });
  return { kind: "ready" as const, rows, summary: summarizePickups(rows, now), generated_at: now };
}

async function writeAppointmentEvent(reference: string, appointmentIdValue: string, type: string, title: string, detail: string | null, actor: Actor, branch: KcplBranch) {
  const db = firebaseAdminDb();
  const now = new Date().toISOString();
  const appointmentRef = db.collection("pickup_appointments").doc(appointmentIdValue);
  const shipmentRef = db.collection("shipments").doc(reference);
  const batch = db.batch();
  batch.create(appointmentRef.collection("events").doc(), { type, title, detail, actor_name: actor.name, actor_email: actor.email, created_at: now });
  batch.create(shipmentRef.collection("job_activity").doc(), { type, title, detail, branch, actor_name: actor.name, actor_email: actor.email, created_at: now, pickup_appointment_id: appointmentIdValue });
  await batch.commit();
}

export async function schedulePickup(reference: string, input: ScheduleInput, actor: Actor, staff: KcplStaffContext) {
  if (!staff.permissions.canManageJobFile) return { kind: "forbidden" as const };
  if (!pickupChannels.includes(input.channel)) return { kind: "invalid_channel" as const };
  const start = validIso(input.windowStart);
  const end = validIso(input.windowEnd);
  if (!validAppointmentWindow(start, end)) return { kind: "invalid_window" as const };
  const scope = await shipmentScope(reference, staff);
  if (scope.kind !== "ready") return scope;
  const db = firebaseAdminDb();
  const id = appointmentId(scope.id);
  const ref = db.collection("pickup_appointments").doc(id);
  const [existingSnapshot, source] = await Promise.all([ref.get(), sourceSnapshots(scope.data)]);
  const existing = existingSnapshot.exists ? appointmentFromData(id, existingSnapshot.data() as Record<string, unknown>) : null;
  if (existing?.status === "picked_up") return { kind: "already_picked_up" as const };
  if (existing?.status === "cancelled") return { kind: "cancelled" as const };
  const now = new Date().toISOString();
  const status: PickupAppointmentStatus = input.confirmed ? "confirmed" : "requested";
  const attemptCount = Math.max(1, (existing?.attempt_count ?? 0) + (existing?.status === "missed" ? 1 : existing ? 0 : 1));
  const data = {
    shipment_reference: scope.id,
    transport_order_id: nullable(scope.data.transport_order_id),
    tender_id: nullable(scope.data.tender_id),
    booking_reference: nullable(scope.data.booking_reference) ?? nullable(source.tender.booking_reference),
    branch: scope.branch,
    customer_id: nullable(scope.data.customer_id),
    customer_name: text(source.customer.display_name, text(source.quote.company_name, text(source.quote.contact_name, "Customer"))),
    partner_id: nullable(source.tender.partner_id),
    partner_name: nullable(source.tender.partner_name) ?? nullable(scope.data.carrier),
    origin: text(source.quote.origin, text(scope.data.origin)),
    destination: text(source.quote.destination, text(scope.data.destination)),
    status,
    channel: input.channel,
    requested_window_start: start,
    requested_window_end: end,
    confirmed_window_start: input.confirmed ? start : null,
    confirmed_window_end: input.confirmed ? end : null,
    pickup_location: input.pickupLocation.trim() || text(source.quote.origin, text(scope.data.origin)) || null,
    contact_name: input.contactName?.trim() || null,
    contact_phone: input.contactPhone?.trim() || null,
    provider_reference: input.providerReference?.trim() || null,
    driver_name: existing?.driver_name ?? null,
    driver_phone: existing?.driver_phone ?? null,
    vehicle_reference: existing?.vehicle_reference ?? null,
    attempt_count: attemptCount,
    picked_up_at: null,
    missed_at: null,
    missed_reason: null,
    notes: input.notes?.trim() || null,
    created_at: existing?.created_at ?? now,
    created_by_name: existing ? undefined : actor.name,
    created_by_email: existing ? undefined : actor.email,
    updated_at: now,
    updated_by_name: actor.name,
    updated_by_email: actor.email,
  };
  const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  const batch = db.batch();
  batch.set(ref, clean, { merge: true });
  batch.update(scope.ref, { pickup_appointment_id: id, pickup_status: status, pickup_window_start: start, pickup_window_end: end, updated_at: now });
  await batch.commit();
  await writeAppointmentEvent(scope.id, id, "pickup_scheduled", input.confirmed ? "Pickup appointment confirmed" : "Pickup requested", `${start} → ${end}${input.pickupLocation ? ` · ${input.pickupLocation}` : ""}`, actor, scope.branch);
  await recordTrackingEvent(scope.id, { source: "manual", rawStatus: "Pickup scheduled", milestone: "pickup_scheduled", location: input.pickupLocation, eta: null, eventTime: now, provider: input.providerReference || source.tender.partner_name ? text(source.tender.partner_name) : "KCPL Pickup Desk", details: `${input.confirmed ? "Confirmed" : "Requested"} pickup window ${start} to ${end}.` }, actor, staff);
  return { kind: "updated" as const, appointment: appointmentFromData(id, clean)! };
}

export async function confirmPickup(reference: string, input: ConfirmInput, actor: Actor, staff: KcplStaffContext) {
  const start = validIso(input.windowStart);
  const end = validIso(input.windowEnd);
  if (!validAppointmentWindow(start, end)) return { kind: "invalid_window" as const };
  const scope = await shipmentScope(reference, staff);
  if (scope.kind !== "ready") return scope;
  if (!staff.permissions.canManageJobFile) return { kind: "forbidden" as const };
  const id = appointmentId(scope.id);
  const ref = firebaseAdminDb().collection("pickup_appointments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing_appointment" as const };
  const current = appointmentFromData(id, snapshot.data() as Record<string, unknown>);
  if (!current || current.status === "picked_up" || current.status === "cancelled") return { kind: "invalid_transition" as const };
  const now = new Date().toISOString();
  await Promise.all([
    ref.update({ status: "confirmed", confirmed_window_start: start, confirmed_window_end: end, provider_reference: input.providerReference?.trim() || current.provider_reference, notes: input.notes?.trim() || current.notes, updated_at: now, updated_by_name: actor.name, updated_by_email: actor.email }),
    scope.ref.update({ pickup_status: "confirmed", pickup_window_start: start, pickup_window_end: end, updated_at: now }),
  ]);
  await writeAppointmentEvent(scope.id, id, "pickup_confirmed", "Carrier/vendor confirmed pickup appointment", `${start} → ${end}${input.providerReference ? ` · ${input.providerReference}` : ""}`, actor, scope.branch);
  return { kind: "updated" as const };
}

export async function assignPickupDriver(reference: string, input: DriverInput, actor: Actor, staff: KcplStaffContext) {
  const scope = await shipmentScope(reference, staff);
  if (scope.kind !== "ready") return scope;
  if (!staff.permissions.canManageJobFile) return { kind: "forbidden" as const };
  if (input.driverName.trim().length < 2) return { kind: "driver_required" as const };
  const id = appointmentId(scope.id);
  const ref = firebaseAdminDb().collection("pickup_appointments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing_appointment" as const };
  const current = appointmentFromData(id, snapshot.data() as Record<string, unknown>);
  if (!current || !["requested", "confirmed", "driver_assigned"].includes(current.status)) return { kind: "invalid_transition" as const };
  const now = new Date().toISOString();
  await Promise.all([
    ref.update({ status: "driver_assigned", driver_name: input.driverName.trim(), driver_phone: input.driverPhone?.trim() || null, vehicle_reference: input.vehicleReference?.trim() || null, notes: input.notes?.trim() || current.notes, updated_at: now, updated_by_name: actor.name, updated_by_email: actor.email }),
    scope.ref.update({ pickup_status: "driver_assigned", pickup_driver_name: input.driverName.trim(), pickup_vehicle_reference: input.vehicleReference?.trim() || null, updated_at: now }),
  ]);
  await writeAppointmentEvent(scope.id, id, "pickup_driver_assigned", "Pickup driver assigned", [input.driverName, input.vehicleReference, input.driverPhone].filter(Boolean).join(" · "), actor, scope.branch);
  return { kind: "updated" as const };
}

export async function completePickup(reference: string, eventTime: string | null, location: string, actor: Actor, staff: KcplStaffContext) {
  const scope = await shipmentScope(reference, staff);
  if (scope.kind !== "ready") return scope;
  if (!staff.permissions.canManageJobFile) return { kind: "forbidden" as const };
  const id = appointmentId(scope.id);
  const ref = firebaseAdminDb().collection("pickup_appointments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing_appointment" as const };
  const current = appointmentFromData(id, snapshot.data() as Record<string, unknown>);
  if (!current || current.status === "picked_up" || current.status === "cancelled") return { kind: "invalid_transition" as const };
  const when = validIso(eventTime) ?? new Date().toISOString();
  const now = new Date().toISOString();
  await Promise.all([
    ref.update({ status: "picked_up", picked_up_at: when, missed_at: null, missed_reason: null, updated_at: now, updated_by_name: actor.name, updated_by_email: actor.email }),
    scope.ref.update({ pickup_status: "picked_up", pickup_completed_at: when, pickup_location: location.trim() || current.pickup_location, updated_at: now }),
  ]);
  await writeAppointmentEvent(scope.id, id, "pickup_completed", "Cargo picked up", `${when}${location ? ` · ${location}` : ""}`, actor, scope.branch);
  await recordTrackingEvent(scope.id, { source: "manual", rawStatus: "Picked up", milestone: "picked_up", location: location || current.pickup_location || "", eta: null, eventTime: when, provider: current.partner_name || "KCPL Pickup Desk", details: `Pickup appointment ${id} completed.` }, actor, staff);
  return { kind: "updated" as const };
}

export async function missPickup(reference: string, reason: string, actor: Actor, staff: KcplStaffContext) {
  const scope = await shipmentScope(reference, staff);
  if (scope.kind !== "ready") return scope;
  if (!staff.permissions.canManageJobFile) return { kind: "forbidden" as const };
  if (reason.trim().length < 6) return { kind: "reason_required" as const };
  const id = appointmentId(scope.id);
  const ref = firebaseAdminDb().collection("pickup_appointments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing_appointment" as const };
  const current = appointmentFromData(id, snapshot.data() as Record<string, unknown>);
  if (!current || current.status === "picked_up" || current.status === "cancelled") return { kind: "invalid_transition" as const };
  const now = new Date().toISOString();
  await Promise.all([
    ref.update({ status: "missed", missed_at: now, missed_reason: reason.trim(), updated_at: now, updated_by_name: actor.name, updated_by_email: actor.email }),
    scope.ref.update({ pickup_status: "missed", updated_at: now }),
  ]);
  await writeAppointmentEvent(scope.id, id, "pickup_missed", "Pickup appointment missed", reason.trim(), actor, scope.branch);
  await recordTrackingEvent(scope.id, { source: "manual", rawStatus: "Pickup missed - carrier exception", milestone: "exception", location: current.pickup_location || "", eta: null, eventTime: now, provider: current.partner_name || "KCPL Pickup Desk", details: reason.trim() }, actor, staff);
  return { kind: "updated" as const };
}

export async function cancelPickup(reference: string, note: string, actor: Actor, staff: KcplStaffContext) {
  const scope = await shipmentScope(reference, staff);
  if (scope.kind !== "ready") return scope;
  if (!staff.permissions.canManageJobFile) return { kind: "forbidden" as const };
  const id = appointmentId(scope.id);
  const ref = firebaseAdminDb().collection("pickup_appointments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing_appointment" as const };
  const current = appointmentFromData(id, snapshot.data() as Record<string, unknown>);
  if (!current || current.status === "picked_up") return { kind: "invalid_transition" as const };
  const now = new Date().toISOString();
  await Promise.all([ref.update({ status: "cancelled", notes: note.trim() || current.notes, updated_at: now, updated_by_name: actor.name, updated_by_email: actor.email }), scope.ref.update({ pickup_status: "cancelled", updated_at: now })]);
  await writeAppointmentEvent(scope.id, id, "pickup_cancelled", "Pickup appointment cancelled", note.trim() || null, actor, scope.branch);
  return { kind: "updated" as const };
}
