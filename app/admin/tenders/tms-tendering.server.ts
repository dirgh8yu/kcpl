import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { confirmConsolidatedLoadBooking } from "../consolidation/tms-consolidation.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { buildDocumentIntelligence, defaultCustomsSteps, defaultWorkflowTasks } from "../workflow-defaults";
import { tmsModes, type TmsMode } from "../rating/tms-rating";
import {
  tenderCanBook,
  tenderCanCancel,
  tenderFinalCommercials,
  tenderIsActive,
  tenderIsExpired,
  tenderResponseAllowed,
  tmsTenderChannels,
  tmsTenderStatuses,
  type TmsTender,
  type TmsTenderChannel,
  type TmsTenderStatus,
} from "./tms-tendering";

type Actor = { name: string; email: string };

type TenderCreateInput = {
  orderId: string;
  channel: TmsTenderChannel;
  recipientName?: string;
  recipientEmail?: string;
  responseDueAt: string;
};

type TenderResponseInput = {
  status: "accepted" | "rejected" | "countered";
  note?: string;
  counterCost?: number | null;
  counterCurrency?: CrmCurrency | null;
};

type TenderBookingInput = {
  bookingReference: string;
  pickupConfirmation?: string;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function currencyValue(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }
function modeValue(value: unknown): TmsMode | null { return tmsModes.includes(value as TmsMode) ? value as TmsMode : null; }
function tenderId() { return `TND-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`; }
function tenderReference() { return `KCPL-T-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`; }
function shipmentReference() { return `KCPL-S-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`; }
function bridgeQuoteReference(orderId: string) { return `TMSQ-${orderId.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }
function eventId(prefix = "evt") { return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`; }
function emailLooksValid(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function futureIso(value: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) && parsed > Date.now() ? new Date(parsed).toISOString() : null; }

function tenderFromData(id: string, data: Record<string, unknown>): TmsTender | null {
  const status = tmsTenderStatuses.includes(data.status as TmsTenderStatus) ? data.status as TmsTenderStatus : null;
  const channel = tmsTenderChannels.includes(data.channel as TmsTenderChannel) ? data.channel as TmsTenderChannel : null;
  const currency = currencyValue(data.currency);
  const mode = modeValue(data.mode);
  if (!status || !channel || !currency || !mode) return null;
  const counterCurrency = currencyValue(data.counter_currency);
  const finalCurrency = currencyValue(data.final_currency);
  return {
    id,
    order_id: text(data.order_id).toUpperCase(),
    tender_reference: text(data.tender_reference, id),
    status,
    channel,
    partner_id: text(data.partner_id).toUpperCase(),
    partner_name: text(data.partner_name, "Partner"),
    recipient_name: nullable(data.recipient_name),
    recipient_email: nullable(data.recipient_email),
    rate_card_id: text(data.rate_card_id),
    mode,
    service: nullable(data.service),
    equipment: nullable(data.equipment),
    currency,
    offered_cost: Math.max(0, numberValue(data.offered_cost)),
    counter_cost: nullableNumber(data.counter_cost),
    counter_currency: counterCurrency,
    final_cost: nullableNumber(data.final_cost),
    final_currency: finalCurrency,
    origin: text(data.origin),
    destination: text(data.destination),
    pickup_date: nullable(data.pickup_date),
    response_due_at: text(data.response_due_at),
    sent_at: text(data.sent_at),
    responded_at: nullable(data.responded_at),
    response_note: nullable(data.response_note),
    booking_reference: nullable(data.booking_reference),
    pickup_confirmation: nullable(data.pickup_confirmation),
    booked_at: nullable(data.booked_at),
    shipment_reference: nullable(data.shipment_reference),
    created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email),
    updated_at: text(data.updated_at),
  };
}

async function orderSnapshot(orderId: string) {
  const id = orderId.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("transport_orders").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const branch = branchValue(data.branch);
  const mode = modeValue(data.mode);
  if (!branch || !mode) return null;
  return { id, ref, snapshot, data, branch, mode };
}

async function tenderSnapshot(id: string) {
  const normalized = id.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("transport_tenders").doc(normalized);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const tender = tenderFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  const branch = branchValue(snapshot.get("branch"));
  return tender && branch ? { ref, snapshot, tender, branch } : null;
}

async function activeTenderForOrder(orderId: string) {
  const snapshot = await firebaseAdminDb().collection("transport_tenders").where("order_id", "==", orderId).limit(50).get();
  const now = new Date().toISOString();
  for (const doc of snapshot.docs) {
    const tender = tenderFromData(doc.id, doc.data() as Record<string, unknown>);
    if (!tender) continue;
    if (tenderIsExpired(tender, now)) {
      await doc.ref.update({ status: "expired", updated_at: now });
      continue;
    }
    if (tenderIsActive(tender.status)) return tender;
  }
  return null;
}

export async function listTmsTenders(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("transport_tenders").orderBy("updated_at", "desc").limit(1000).get();
  const now = new Date().toISOString();
  const tenders: TmsTender[] = [];
  const expiryWrites: Promise<unknown>[] = [];
  for (const doc of snapshot.docs) {
    const tender = tenderFromData(doc.id, doc.data() as Record<string, unknown>);
    const branch = branchValue(doc.get("branch"));
    if (!tender || !branch || !staffCanAccessBranch(staff, branch)) continue;
    if (tenderIsExpired(tender, now)) {
      tender.status = "expired";
      tender.updated_at = now;
      expiryWrites.push(doc.ref.update({ status: "expired", updated_at: now }));
    }
    tenders.push(tender);
  }
  if (expiryWrites.length) await Promise.all(expiryWrites);
  return { kind: "ready" as const, tenders };
}

export async function createTmsTender(input: TenderCreateInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  if (!tmsTenderChannels.includes(input.channel)) return { kind: "invalid" as const };
  const dueAt = futureIso(input.responseDueAt);
  if (!dueAt) return { kind: "invalid_deadline" as const };
  const recipientEmail = input.recipientEmail?.trim().toLowerCase() || "";
  if (input.channel === "email" && !emailLooksValid(recipientEmail)) return { kind: "recipient_required" as const };

  const order = await orderSnapshot(input.orderId);
  if (!order) return { kind: "missing_order" as const };
  if (!staffCanAccessBranch(staff, order.branch)) return { kind: "forbidden" as const };
  if (nullable(order.data.consolidation_load_id) && order.data.is_consolidation_master !== true) return { kind: "consolidated_order" as const };
  if (text(order.data.status) !== "selected") return { kind: "rate_required" as const };
  const rateCardId = text(order.data.selected_rate_card_id);
  const partnerId = text(order.data.selected_partner_id).trim().toUpperCase();
  const offeredCost = nullableNumber(order.data.selected_cost);
  const offeredCurrency = currencyValue(order.data.selected_currency);
  if (!rateCardId || !partnerId || offeredCost === null || !offeredCurrency) return { kind: "rate_required" as const };
  if (await activeTenderForOrder(order.id)) return { kind: "active_tender" as const };

  const rateCard = await firebaseAdminDb().collection("partner_rate_cards").doc(rateCardId).get();
  if (!rateCard.exists || text(rateCard.get("partner_id")).trim().toUpperCase() !== partnerId) return { kind: "rate_unavailable" as const };

  const id = tenderId();
  const ref = firebaseAdminDb().collection("transport_tenders").doc(id);
  const now = new Date().toISOString();
  const data = {
    order_id: order.id,
    tender_reference: tenderReference(),
    branch: order.branch,
    status: "sent",
    channel: input.channel,
    partner_id: partnerId,
    partner_name: text(rateCard.get("partner_name"), partnerId),
    recipient_name: input.recipientName?.trim() || null,
    recipient_email: recipientEmail || null,
    rate_card_id: rateCardId,
    mode: order.mode,
    service: nullable(rateCard.get("service")),
    equipment: nullable(rateCard.get("equipment")),
    currency: offeredCurrency,
    offered_cost: offeredCost,
    counter_cost: null,
    counter_currency: null,
    final_cost: null,
    final_currency: null,
    origin: text(order.data.origin),
    destination: text(order.data.destination),
    pickup_date: nullable(order.data.pickup_date),
    response_due_at: dueAt,
    sent_at: now,
    responded_at: null,
    response_note: null,
    booking_reference: null,
    pickup_confirmation: null,
    booked_at: null,
    shipment_reference: null,
    consolidation_load_id: nullable(order.data.consolidation_load_id),
    is_consolidation_master: order.data.is_consolidation_master === true,
    created_by_name: actor.name,
    created_by_email: actor.email,
    updated_at: now,
  };

  const batch = firebaseAdminDb().batch();
  batch.create(ref, data);
  batch.update(order.ref, { status: "tendering", active_tender_id: id, updated_at: now });
  batch.create(order.ref.collection("events").doc(eventId()), {
    type: "tender_sent",
    title: `Tender sent to ${data.partner_name}`,
    detail: `${data.tender_reference} · ${offeredCurrency} ${offeredCost.toFixed(2)} · response due ${dueAt}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "created" as const, tender: tenderFromData(id, data)! };
}

export async function respondToTmsTender(tenderIdValue: string, input: TenderResponseInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await tenderSnapshot(tenderIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.branch)) return { kind: "forbidden" as const };
  const now = new Date().toISOString();
  if (tenderIsExpired(record.tender, now)) {
    const order = await orderSnapshot(record.tender.order_id);
    const batch = firebaseAdminDb().batch();
    batch.update(record.ref, { status: "expired", updated_at: now });
    if (order) batch.update(order.ref, { status: "selected", active_tender_id: null, updated_at: now });
    await batch.commit();
    return { kind: "expired" as const };
  }
  if (!tenderResponseAllowed(record.tender.status, input.status)) return { kind: "invalid_transition" as const };

  let counterCost: number | null = null;
  let counterCurrency: CrmCurrency | null = null;
  if (input.status === "countered") {
    counterCost = input.counterCost ?? null;
    counterCurrency = input.counterCurrency ?? null;
    if (counterCost === null || !Number.isFinite(counterCost) || counterCost < 0 || !counterCurrency || !crmCurrencies.includes(counterCurrency)) return { kind: "invalid_counter" as const };
  }
  const order = await orderSnapshot(record.tender.order_id);
  if (!order) return { kind: "missing_order" as const };

  const update = {
    status: input.status,
    responded_at: now,
    response_note: input.note?.trim() || null,
    counter_cost: counterCost,
    counter_currency: counterCurrency,
    updated_at: now,
  };
  const batch = firebaseAdminDb().batch();
  batch.update(record.ref, update);
  if (input.status === "rejected") batch.update(order.ref, { status: "selected", active_tender_id: null, updated_at: now });
  batch.create(order.ref.collection("events").doc(eventId()), {
    type: `tender_${input.status}`,
    title: `${record.tender.partner_name}: ${input.status === "countered" ? "counter-offer recorded" : `tender ${input.status}`}`,
    detail: input.status === "countered" ? `${counterCurrency} ${counterCost!.toFixed(2)}` : input.note?.trim() || null,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "updated" as const, tender: tenderFromData(record.tender.id, { ...record.snapshot.data(), ...update })! };
}

export async function cancelTmsTender(tenderIdValue: string, note: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await tenderSnapshot(tenderIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.branch)) return { kind: "forbidden" as const };
  if (!tenderCanCancel(record.tender.status)) return { kind: "invalid_transition" as const };
  const order = await orderSnapshot(record.tender.order_id);
  if (!order) return { kind: "missing_order" as const };
  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(record.ref, { status: "cancelled", response_note: note.trim() || null, updated_at: now });
  batch.update(order.ref, { status: "selected", active_tender_id: null, updated_at: now });
  batch.create(order.ref.collection("events").doc(eventId()), {
    type: "tender_cancelled",
    title: `Tender cancelled: ${record.tender.tender_reference}`,
    detail: note.trim() || null,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "cancelled" as const };
}

async function createBookedShipment(
  record: Awaited<ReturnType<typeof tenderSnapshot>> & {},
  order: NonNullable<Awaited<ReturnType<typeof orderSnapshot>>>,
  commercials: { amount: number; currency: CrmCurrency },
  input: TenderBookingInput,
  actor: Actor,
) {
  if (!order.data.customer_id) return { kind: "customer_required" as const };
  const customerId = text(order.data.customer_id).trim().toUpperCase();
  const customerRef = firebaseAdminDb().collection("customers").doc(customerId);
  const customer = await customerRef.get();
  if (!customer.exists || customer.get("archived") === true) return { kind: "customer_missing" as const };

  const reference = shipmentReference();
  const shipmentRef = firebaseAdminDb().collection("shipments").doc(reference);
  const quoteReference = bridgeQuoteReference(order.id);
  const quoteRef = firebaseAdminDb().collection("quotes").doc(quoteReference);
  const now = new Date().toISOString();
  const bookingReference = input.bookingReference.trim();
  if (!bookingReference) return { kind: "booking_reference_required" as const };

  const documentPlan = buildDocumentIntelligence({
    mode: order.mode,
    origin: text(order.data.origin),
    destination: text(order.data.destination),
    primaryBranch: order.branch,
  });

  const batch = firebaseAdminDb().batch();
  batch.set(quoteRef, {
    reference: quoteReference,
    status: "won",
    migration_hidden: true,
    source: "tms_order_booking_bridge",
    transport_order_id: order.id,
    customer_id: customerId,
    company_name: text(customer.get("display_name"), customerId),
    contact_name: "",
    contact_email: text(customer.get("primary_email")),
    phone: text(customer.get("primary_phone")),
    origin: text(order.data.origin),
    destination: text(order.data.destination),
    mode: order.mode,
    cargo_type: "",
    quote_currency: text(customer.get("preferred_currency"), "NPR"),
    quoted_amount: null,
    internal_cost: null,
    assigned_to: actor.name,
    assigned_to_name: actor.name,
    assigned_to_email: actor.email,
    shipment_reference: reference,
    created_at: now,
    updated_at: now,
  }, { merge: true });

  batch.create(shipmentRef, {
    reference,
    quote_reference: quoteReference,
    transport_order_id: order.id,
    tender_id: record.tender.id,
    tender_reference: record.tender.tender_reference,
    customer_id: customerId,
    primary_branch: order.branch,
    handling_branches: [order.branch],
    origin: text(order.data.origin),
    destination: text(order.data.destination),
    mode: order.mode,
    job_priority: "standard",
    job_assigned_to_uid: null,
    job_assigned_to_name: null,
    job_assigned_to_email: null,
    job_assigned_to_phone: null,
    internal_job_reference: order.id,
    internal_job_notes: nullable(order.data.notes),
    workflow_version: 1,
    job_closed_at: null,
    job_closed_by_name: null,
    job_closed_by_email: null,
    job_close_note: null,
    job_close_overridden: false,
    status: "booking_confirmed",
    eta: null,
    current_location: text(order.data.origin),
    carrier: record.tender.partner_name,
    carrier_reference: bookingReference,
    partner_id: record.tender.partner_id,
    procurement_rate_card_id: record.tender.rate_card_id,
    procurement_cost: commercials.amount,
    procurement_currency: commercials.currency,
    customer_note: null,
    created_at: now,
    updated_at: now,
  });

  const shipmentEventNumericId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  batch.create(shipmentRef.collection("events").doc(String(shipmentEventNumericId)), {
    id: shipmentEventNumericId,
    shipment_reference: reference,
    title: "Booking confirmed",
    location: text(order.data.origin) || null,
    details: `Booked with ${record.tender.partner_name}. Carrier / partner reference: ${bookingReference}.`,
    event_time: now,
    created_at: now,
    author_name: actor.name || "KCPL Operations",
  });

  for (const task of defaultWorkflowTasks(order.mode, order.branch)) {
    batch.create(shipmentRef.collection("job_tasks").doc(`task-${crypto.randomUUID()}`), {
      title: task.title,
      detail: task.detail,
      branch: task.branch,
      due_at: null,
      assigned_to_uid: null,
      assigned_to_name: null,
      assigned_to_email: null,
      assigned_to_phone: null,
      completed: false,
      completed_at: null,
      completed_by: null,
      created_at: now,
      created_by: actor.email || "workflow@kcpl.internal",
      workflow_seeded: true,
    });
  }
  for (const step of defaultCustomsSteps(order.mode, order.branch)) {
    batch.create(shipmentRef.collection("customs_steps").doc(`customs-${crypto.randomUUID()}`), {
      title: step.title,
      detail: step.detail,
      branch: step.branch,
      required: step.required,
      completed: false,
      completed_at: null,
      completed_by: null,
      created_at: now,
      created_by: actor.email || "workflow@kcpl.internal",
      workflow_seeded: true,
    });
  }
  for (const requirement of documentPlan.requirements) {
    batch.set(shipmentRef.collection("document_requirements").doc(requirement.documentType), {
      document_type: requirement.documentType,
      required: requirement.required,
      reason: requirement.reason,
      source: requirement.source,
      advisory: requirement.advisory === true,
      created_at: now,
      updated_at: now,
    });
  }
  batch.create(shipmentRef.collection("job_activity").doc(eventId("activity")), {
    type: "tms_booking_confirmed",
    title: `TMS booking confirmed with ${record.tender.partner_name}`,
    detail: `${record.tender.tender_reference} · ${commercials.currency} ${commercials.amount.toFixed(2)} · ${bookingReference}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });

  const currentActive = Math.max(0, numberValue(customer.get("active_shipment_count")));
  const currentStatus = text(customer.get("account_status"));
  batch.update(customerRef, {
    active_shipment_count: currentActive + 1,
    lead_stage: "won",
    ...(currentStatus === "prospect" || currentStatus === "dormant" ? { account_status: "active" } : {}),
    updated_at: now,
  });
  batch.create(customerRef.collection("activity").doc(eventId("activity")), {
    type: "shipment_created",
    title: `Shipment opened from TMS booking: ${reference}`,
    detail: `${text(order.data.origin)} → ${text(order.data.destination)} · ${record.tender.partner_name}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });

  batch.update(record.ref, {
    status: "booked",
    final_cost: commercials.amount,
    final_currency: commercials.currency,
    booking_reference: bookingReference,
    pickup_confirmation: input.pickupConfirmation?.trim() || null,
    booked_at: now,
    shipment_reference: reference,
    updated_at: now,
  });
  batch.update(order.ref, {
    status: "booked",
    active_tender_id: null,
    booked_tender_id: record.tender.id,
    booking_reference: bookingReference,
    shipment_reference: reference,
    selected_cost: commercials.amount,
    selected_currency: commercials.currency,
    updated_at: now,
  });
  batch.create(order.ref.collection("events").doc(eventId()), {
    type: "booking_confirmed",
    title: `Booking confirmed: ${record.tender.partner_name}`,
    detail: `${reference} · ${commercials.currency} ${commercials.amount.toFixed(2)} · ${bookingReference}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });

  await batch.commit();
  return { kind: "booked" as const, shipmentReference: reference };
}

export async function confirmTmsTenderBooking(tenderIdValue: string, input: TenderBookingInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await tenderSnapshot(tenderIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.branch)) return { kind: "forbidden" as const };
  if (record.tender.status === "booked" && record.tender.shipment_reference) return { kind: "booked" as const, shipmentReference: record.tender.shipment_reference };
  if (!tenderCanBook(record.tender.status)) return { kind: "invalid_transition" as const };
  const commercials = tenderFinalCommercials(record.tender);
  if (!commercials) return { kind: "commercials_required" as const };
  const order = await orderSnapshot(record.tender.order_id);
  if (!order) return { kind: "missing_order" as const };
  if (text(order.data.status) === "booked" && nullable(order.data.shipment_reference)) return { kind: "booked" as const, shipmentReference: nullable(order.data.shipment_reference)! };

  const loadId = nullable(order.data.consolidation_load_id);
  if (order.data.is_consolidation_master === true && loadId) {
    const consolidated = await confirmConsolidatedLoadBooking({
      loadId,
      masterOrderId: order.id,
      tenderId: record.tender.id,
      tenderReference: record.tender.tender_reference,
      partnerId: record.tender.partner_id,
      partnerName: record.tender.partner_name,
      rateCardId: record.tender.rate_card_id,
      bookingReference: input.bookingReference,
      pickupConfirmation: input.pickupConfirmation,
      amount: commercials.amount,
      currency: commercials.currency,
    }, actor, staff);
    if (consolidated.kind === "booked") return { kind: "booked" as const, shipmentReference: consolidated.masterShipmentReference ?? consolidated.shipmentReferences[0] ?? "", shipmentReferences: consolidated.shipmentReferences, consolidationLoadId: loadId };
    return consolidated;
  }

  return createBookedShipment(record, order, commercials, input, actor);
}
