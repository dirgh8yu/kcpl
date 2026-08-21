import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { tmsModes, type TmsMode, type TmsOrder } from "../rating/tms-rating";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { buildDocumentIntelligence, defaultCustomsSteps, defaultWorkflowTasks } from "../workflow-defaults";
import {
  allocateProcurementCost,
  assessLoadCompatibility,
  buildDefaultStops,
  capacityViolations,
  loadTotals,
  normalizeStopSequence,
  tmsLoadStatuses,
  validateStopPrecedence,
  type LoadCapacity,
  type TmsConsolidationLoad,
  type TmsLoadMember,
  type TmsLoadStatus,
  type TmsLoadStop,
} from "./tms-consolidation";

type Actor = { name: string; email: string };

type LoadCreateInput = {
  name: string;
  mode: TmsMode;
  orderIds: string[];
  equipment?: string;
  capacityWeightKg?: number | null;
  capacityVolumeCbm?: number | null;
  capacityPieces?: number | null;
  capacityContainers?: number | null;
};

type ConsolidatedBookingInput = {
  loadId: string;
  masterOrderId: string;
  tenderId: string;
  tenderReference: string;
  partnerId: string;
  partnerName: string;
  rateCardId: string;
  bookingReference: string;
  pickupConfirmation?: string;
  amount: number;
  currency: CrmCurrency;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function num(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNum(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function modeValue(value: unknown): TmsMode | null { return tmsModes.includes(value as TmsMode) ? value as TmsMode : null; }
function currencyValue(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }
function loadStatus(value: unknown): TmsLoadStatus | null { return tmsLoadStatuses.includes(value as TmsLoadStatus) ? value as TmsLoadStatus : null; }
function loadId() { return `LOAD-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`; }
function loadReference() { return `KCPL-L-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`; }
function masterOrderId(id: string) { return `ORD-${id}`.slice(0, 120); }
function shipmentReference(prefix = "S") { return `KCPL-${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`; }
function eventId(prefix = "evt") { return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`; }
function bridgeQuoteReference(orderId: string) { return `TMSQ-${orderId.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }
function masterBridgeQuoteReference(id: string) { return `TMSQ-MASTER-${id.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }

function capacityFromData(data: Record<string, unknown>): LoadCapacity {
  return {
    weight_kg: nullableNum(data.capacity_weight_kg),
    volume_cbm: nullableNum(data.capacity_volume_cbm),
    pieces: nullableNum(data.capacity_pieces),
    containers: nullableNum(data.capacity_containers),
  };
}

function orderFromSnapshot(id: string, data: Record<string, unknown>): (TmsOrder & { consolidation_load_id?: string | null; is_consolidation_master?: boolean }) | null {
  const branch = branchValue(data.branch);
  const mode = modeValue(data.mode);
  if (!branch || !mode) return null;
  const selectedCurrency = currencyValue(data.selected_currency);
  const statusRaw = text(data.status);
  const status = ["draft", "rated", "selected", "tendering", "booked", "cancelled"].includes(statusRaw) ? statusRaw as TmsOrder["status"] : "draft";
  return {
    id,
    branch,
    customer_id: nullable(data.customer_id),
    customer_name: nullable(data.customer_name),
    origin: text(data.origin),
    destination: text(data.destination),
    mode,
    pickup_date: nullable(data.pickup_date),
    delivery_date: nullable(data.delivery_date),
    weight_kg: Math.max(0, num(data.weight_kg)),
    volume_cbm: Math.max(0, num(data.volume_cbm)),
    pieces: Math.max(0, Math.trunc(num(data.pieces))),
    container_count: Math.max(0, Math.trunc(num(data.container_count))),
    equipment: nullable(data.equipment),
    temperature_requirement: nullable(data.temperature_requirement),
    carrier_requirement: nullable(data.carrier_requirement),
    notes: nullable(data.notes),
    status,
    selected_rate_card_id: nullable(data.selected_rate_card_id),
    selected_partner_id: nullable(data.selected_partner_id),
    selected_cost: nullableNum(data.selected_cost),
    selected_currency: selectedCurrency,
    created_at: text(data.created_at),
    created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email),
    updated_at: text(data.updated_at),
    consolidation_load_id: nullable(data.consolidation_load_id),
    is_consolidation_master: data.is_consolidation_master === true,
  };
}

function memberFromOrder(order: TmsOrder): TmsLoadMember {
  return {
    order_id: order.id,
    customer_id: order.customer_id,
    customer_name: order.customer_name,
    origin: order.origin,
    destination: order.destination,
    mode: order.mode,
    weight_kg: order.weight_kg,
    volume_cbm: order.volume_cbm,
    pieces: order.pieces,
    container_count: order.container_count,
    equipment: order.equipment,
    temperature_requirement: order.temperature_requirement,
    prior_selected_cost: order.selected_cost,
    prior_selected_currency: order.selected_currency,
    allocated_cost: null,
    allocated_currency: null,
    shipment_reference: null,
  };
}

function memberFromData(value: unknown): TmsLoadMember | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const mode = modeValue(data.mode);
  const priorCurrency = currencyValue(data.prior_selected_currency);
  const allocatedCurrency = currencyValue(data.allocated_currency);
  const orderIdValue = text(data.order_id).trim().toUpperCase();
  if (!orderIdValue || !mode) return null;
  return {
    order_id: orderIdValue,
    customer_id: nullable(data.customer_id),
    customer_name: nullable(data.customer_name),
    origin: text(data.origin),
    destination: text(data.destination),
    mode,
    weight_kg: Math.max(0, num(data.weight_kg)),
    volume_cbm: Math.max(0, num(data.volume_cbm)),
    pieces: Math.max(0, Math.trunc(num(data.pieces))),
    container_count: Math.max(0, Math.trunc(num(data.container_count))),
    equipment: nullable(data.equipment),
    temperature_requirement: nullable(data.temperature_requirement),
    prior_selected_cost: nullableNum(data.prior_selected_cost),
    prior_selected_currency: priorCurrency,
    allocated_cost: nullableNum(data.allocated_cost),
    allocated_currency: allocatedCurrency,
    shipment_reference: nullable(data.shipment_reference),
  };
}

function stopFromData(value: unknown): TmsLoadStop | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const kind = ["pickup", "hub", "customs", "delivery"].includes(text(data.kind)) ? text(data.kind) as TmsLoadStop["kind"] : null;
  const id = text(data.id).trim();
  if (!kind || !id) return null;
  return {
    id,
    sequence: Math.max(1, Math.trunc(num(data.sequence, 1))),
    kind,
    location: text(data.location),
    order_ids: Array.isArray(data.order_ids) ? data.order_ids.filter((item): item is string => typeof item === "string").map((item) => item.toUpperCase()) : [],
    planned_at: nullable(data.planned_at),
    instructions: nullable(data.instructions),
  };
}

function loadFromData(id: string, data: Record<string, unknown>): TmsConsolidationLoad | null {
  const branch = branchValue(data.branch);
  const mode = modeValue(data.mode);
  const status = loadStatus(data.status);
  if (!branch || !mode || !status) return null;
  const members = Array.isArray(data.members) ? data.members.map(memberFromData).filter((item): item is TmsLoadMember => Boolean(item)) : [];
  const stops = Array.isArray(data.stops) ? data.stops.map(stopFromData).filter((item): item is TmsLoadStop => Boolean(item)).sort((a, b) => a.sequence - b.sequence) : [];
  return {
    id,
    reference: text(data.reference, id),
    name: text(data.name, text(data.reference, id)),
    branch,
    mode,
    status,
    equipment: nullable(data.equipment),
    capacity_weight_kg: nullableNum(data.capacity_weight_kg),
    capacity_volume_cbm: nullableNum(data.capacity_volume_cbm),
    capacity_pieces: nullableNum(data.capacity_pieces),
    capacity_containers: nullableNum(data.capacity_containers),
    members,
    stops,
    master_order_id: nullable(data.master_order_id),
    master_tender_id: nullable(data.master_tender_id),
    master_booking_reference: nullable(data.master_booking_reference),
    procurement_partner_id: nullable(data.procurement_partner_id),
    procurement_partner_name: nullable(data.procurement_partner_name),
    procurement_cost: nullableNum(data.procurement_cost),
    procurement_currency: currencyValue(data.procurement_currency),
    created_at: text(data.created_at),
    created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email),
    updated_at: text(data.updated_at),
  };
}

async function getOrder(id: string) {
  const normalized = id.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("transport_orders").doc(normalized);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const order = orderFromSnapshot(snapshot.id, snapshot.data() as Record<string, unknown>);
  return order ? { ref, snapshot, order, data: snapshot.data() as Record<string, unknown> } : null;
}

async function getLoad(id: string) {
  const normalized = id.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("consolidation_loads").doc(normalized);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const load = loadFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  return load ? { ref, snapshot, load, data: snapshot.data() as Record<string, unknown> } : null;
}

async function loadOrders(ids: string[]) {
  const records = await Promise.all([...new Set(ids.map((id) => id.trim().toUpperCase()).filter(Boolean))].map(getOrder));
  return records.filter((record): record is NonNullable<typeof record> => Boolean(record));
}

function loadCapacity(load: TmsConsolidationLoad): LoadCapacity {
  return { weight_kg: load.capacity_weight_kg, volume_cbm: load.capacity_volume_cbm, pieces: load.capacity_pieces, containers: load.capacity_containers };
}

export async function listConsolidationLoads(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("consolidation_loads").orderBy("updated_at", "desc").limit(500).get();
  const loads = snapshot.docs.map((doc) => loadFromData(doc.id, doc.data() as Record<string, unknown>)).filter((load): load is TmsConsolidationLoad => Boolean(load));
  return { kind: "ready" as const, loads: loads.filter((load) => staffCanAccessBranch(staff, load.branch)) };
}

export async function createConsolidationLoad(input: LoadCreateInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  if (!tmsModes.includes(input.mode)) return { kind: "invalid" as const };
  const records = await loadOrders(input.orderIds);
  if (records.length !== new Set(input.orderIds.map((id) => id.trim().toUpperCase()).filter(Boolean)).size) return { kind: "missing_order" as const };
  const orders = records.map((record) => record.order);
  if (!orders.length || !staffCanAccessBranch(staff, orders[0].branch) || orders.some((order) => !staffCanAccessBranch(staff, order.branch))) return { kind: "forbidden" as const };
  const capacity: LoadCapacity = {
    weight_kg: input.capacityWeightKg ?? null,
    volume_cbm: input.capacityVolumeCbm ?? null,
    pieces: input.capacityPieces ?? null,
    containers: input.capacityContainers ?? null,
  };
  const compatibility = assessLoadCompatibility(orders, input.mode, capacity);
  if (!compatibility.ok) return { kind: "incompatible" as const, compatibility };

  const id = loadId();
  const reference = loadReference();
  const now = new Date().toISOString();
  const members = orders.map(memberFromOrder);
  const stops = buildDefaultStops(orders);
  const document = {
    reference,
    name: input.name.trim() || reference,
    branch: orders[0].branch,
    mode: input.mode,
    status: "draft",
    equipment: input.equipment?.trim() || orders.find((order) => order.equipment)?.equipment || null,
    capacity_weight_kg: capacity.weight_kg,
    capacity_volume_cbm: capacity.volume_cbm,
    capacity_pieces: capacity.pieces,
    capacity_containers: capacity.containers,
    members,
    stops,
    master_order_id: null,
    master_tender_id: null,
    master_booking_reference: null,
    procurement_partner_id: null,
    procurement_partner_name: null,
    procurement_cost: null,
    procurement_currency: null,
    created_at: now,
    created_by_name: actor.name,
    created_by_email: actor.email,
    updated_at: now,
  };
  const ref = firebaseAdminDb().collection("consolidation_loads").doc(id);
  const batch = firebaseAdminDb().batch();
  batch.create(ref, document);
  batch.create(ref.collection("events").doc(eventId()), { type: "load_created", title: `${reference} created`, detail: `${orders.length} orders · ${input.mode}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
  for (const record of records) {
    batch.update(record.ref, { consolidation_load_id: id, consolidation_reference: reference, updated_at: now });
    batch.create(record.ref.collection("events").doc(eventId()), { type: "added_to_consolidation", title: `Added to consolidation ${reference}`, detail: input.name.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now });
  }
  await batch.commit();
  return { kind: "created" as const, load: loadFromData(id, document)!, compatibility };
}

export async function addOrderToConsolidationLoad(loadIdValue: string, orderIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getLoad(loadIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
  if (record.load.status !== "draft") return { kind: "locked" as const };
  if (record.load.members.some((member) => member.order_id === orderIdValue.trim().toUpperCase())) return { kind: "ready" as const, load: record.load };
  const order = await getOrder(orderIdValue);
  if (!order) return { kind: "missing_order" as const };
  if (!staffCanAccessBranch(staff, order.order.branch)) return { kind: "forbidden" as const };
  const existing = await loadOrders(record.load.members.map((member) => member.order_id));
  const orders = [...existing.map((item) => item.order), order.order];
  const compatibility = assessLoadCompatibility(orders, record.load.mode, loadCapacity(record.load));
  if (!compatibility.ok) return { kind: "incompatible" as const, compatibility };
  const members = orders.map(memberFromOrder);
  const stops = buildDefaultStops(orders);
  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(record.ref, { members, stops, updated_at: now });
  batch.update(order.ref, { consolidation_load_id: record.load.id, consolidation_reference: record.load.reference, updated_at: now });
  batch.create(record.ref.collection("events").doc(eventId()), { type: "order_added", title: `${order.order.id} added to load`, detail: "Stop sequence was regenerated; review route order before procurement.", actor_name: actor.name, actor_email: actor.email, created_at: now });
  await batch.commit();
  return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, members, stops, updated_at: now })!, compatibility };
}

export async function removeOrderFromConsolidationLoad(loadIdValue: string, orderIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getLoad(loadIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
  if (record.load.status !== "draft") return { kind: "locked" as const };
  const normalized = orderIdValue.trim().toUpperCase();
  if (!record.load.members.some((member) => member.order_id === normalized)) return { kind: "missing_order" as const };
  const remainingIds = record.load.members.map((member) => member.order_id).filter((id) => id !== normalized);
  if (remainingIds.length < 2) return { kind: "minimum_members" as const };
  const remaining = await loadOrders(remainingIds);
  if (remaining.length !== remainingIds.length) return { kind: "missing_order" as const };
  const members = remaining.map((item) => memberFromOrder(item.order));
  const stops = buildDefaultStops(remaining.map((item) => item.order));
  const order = await getOrder(normalized);
  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(record.ref, { members, stops, updated_at: now });
  if (order) batch.update(order.ref, { consolidation_load_id: null, consolidation_reference: null, procurement_locked_by_load: false, updated_at: now });
  batch.create(record.ref.collection("events").doc(eventId()), { type: "order_removed", title: `${normalized} removed from load`, detail: "Stop sequence was regenerated; review route order before procurement.", actor_name: actor.name, actor_email: actor.email, created_at: now });
  await batch.commit();
  return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, members, stops, updated_at: now })! };
}

export async function reorderConsolidationStops(loadIdValue: string, orderedStopIds: string[], actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getLoad(loadIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
  if (record.load.status !== "draft") return { kind: "locked" as const };
  const stops = normalizeStopSequence(record.load.stops, orderedStopIds);
  if (!stops) return { kind: "invalid_sequence" as const };
  const precedence = validateStopPrecedence(stops);
  if (precedence.length) return { kind: "precedence" as const, orderIds: precedence };
  const now = new Date().toISOString();
  await record.ref.update({ stops, updated_at: now });
  await record.ref.collection("events").doc(eventId()).create({ type: "stops_reordered", title: "Load stop sequence updated", detail: stops.map((stop) => `${stop.sequence}. ${stop.location}`).join(" · "), actor_name: actor.name, actor_email: actor.email, created_at: now });
  return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, stops, updated_at: now })! };
}

export async function updateConsolidationStop(loadIdValue: string, stopIdValue: string, values: { plannedAt?: string; instructions?: string }, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getLoad(loadIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
  if (record.load.status !== "draft") return { kind: "locked" as const };
  const stopId = stopIdValue.trim();
  if (!record.load.stops.some((stop) => stop.id === stopId)) return { kind: "missing_stop" as const };
  const plannedAtRaw = values.plannedAt?.trim() || "";
  const plannedAt = plannedAtRaw && Number.isFinite(Date.parse(plannedAtRaw)) ? new Date(plannedAtRaw).toISOString() : null;
  const stops = record.load.stops.map((stop) => stop.id === stopId ? { ...stop, planned_at: plannedAt, instructions: values.instructions?.trim() || null } : stop);
  const now = new Date().toISOString();
  await record.ref.update({ stops, updated_at: now });
  await record.ref.collection("events").doc(eventId()).create({ type: "stop_updated", title: `Stop updated: ${stops.find((stop) => stop.id === stopId)?.location ?? stopId}`, detail: values.instructions?.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now });
  return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, stops, updated_at: now })! };
}

export async function releaseConsolidationToProcurement(loadIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getLoad(loadIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
  if (record.load.status !== "draft") return record.load.master_order_id ? { kind: "ready" as const, masterOrderId: record.load.master_order_id } : { kind: "locked" as const };
  if (record.load.members.length < 2) return { kind: "minimum_members" as const };
  if (validateStopPrecedence(record.load.stops).length) return { kind: "precedence" as const };
  const records = await loadOrders(record.load.members.map((member) => member.order_id));
  if (records.length !== record.load.members.length) return { kind: "missing_order" as const };
  if (records.some((item) => !item.order.customer_id)) return { kind: "customer_required" as const };
  const totals = loadTotals(records.map((item) => item.order));
  const capacityBlockers = capacityViolations(totals, loadCapacity(record.load));
  if (capacityBlockers.length) return { kind: "capacity" as const, blockers: capacityBlockers };
  const first = [...record.load.stops].sort((a, b) => a.sequence - b.sequence)[0];
  const last = [...record.load.stops].sort((a, b) => b.sequence - a.sequence)[0];
  if (!first || !last) return { kind: "invalid_sequence" as const };
  const id = masterOrderId(record.load.id);
  const orderRef = firebaseAdminDb().collection("transport_orders").doc(id);
  const existing = await orderRef.get();
  if (existing.exists) return { kind: "ready" as const, masterOrderId: id };
  const now = new Date().toISOString();
  const pickupDates = records.map((item) => item.order.pickup_date).filter((value): value is string => Boolean(value)).sort();
  const deliveryDates = records.map((item) => item.order.delivery_date).filter((value): value is string => Boolean(value)).sort();
  const master = {
    branch: record.load.branch,
    customer_id: null,
    customer_name: `Consolidation ${record.load.reference}`,
    origin: first.location,
    destination: last.location,
    mode: record.load.mode,
    pickup_date: pickupDates[0] ?? null,
    delivery_date: deliveryDates.at(-1) ?? null,
    weight_kg: totals.weight_kg,
    volume_cbm: totals.volume_cbm,
    pieces: totals.pieces,
    container_count: totals.containers,
    equipment: record.load.equipment,
    temperature_requirement: records.map((item) => item.order.temperature_requirement).find(Boolean) ?? null,
    carrier_requirement: `Consolidated load ${record.load.reference} · ${record.load.stops.length} stops`,
    notes: `Master procurement order for ${record.load.reference}. Stops: ${record.load.stops.map((stop) => `${stop.sequence}:${stop.location}`).join(" | ")}`,
    status: "draft",
    selected_rate_card_id: null,
    selected_partner_id: null,
    selected_cost: null,
    selected_currency: null,
    consolidation_load_id: record.load.id,
    consolidation_reference: record.load.reference,
    is_consolidation_master: true,
    created_at: now,
    created_by_name: actor.name,
    created_by_email: actor.email,
    updated_at: now,
  };
  const batch = firebaseAdminDb().batch();
  batch.create(orderRef, master);
  batch.update(record.ref, { status: "ready_for_procurement", master_order_id: id, updated_at: now });
  batch.create(record.ref.collection("events").doc(eventId()), { type: "released_to_procurement", title: `Master procurement order ${id} created`, detail: `${record.load.members.length} house orders · ${record.load.stops.length} stops`, actor_name: actor.name, actor_email: actor.email, created_at: now });
  for (const item of records) {
    batch.update(item.ref, { procurement_locked_by_load: true, consolidation_master_order_id: id, updated_at: now });
    batch.create(item.ref.collection("events").doc(eventId()), { type: "consolidation_procurement_locked", title: `Procurement moved to master load ${record.load.reference}`, detail: id, actor_name: actor.name, actor_email: actor.email, created_at: now });
  }
  await batch.commit();
  return { kind: "released" as const, masterOrderId: id };
}

export async function cancelDraftConsolidationLoad(loadIdValue: string, note: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getLoad(loadIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
  if (record.load.status !== "draft") return { kind: "locked" as const };
  const orders = await loadOrders(record.load.members.map((member) => member.order_id));
  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(record.ref, { status: "cancelled", updated_at: now });
  batch.create(record.ref.collection("events").doc(eventId()), { type: "load_cancelled", title: "Consolidation load cancelled", detail: note.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now });
  for (const order of orders) batch.update(order.ref, { consolidation_load_id: null, consolidation_reference: null, procurement_locked_by_load: false, consolidation_master_order_id: null, updated_at: now });
  await batch.commit();
  return { kind: "cancelled" as const };
}

function seedShipmentWorkflow(batch: FirebaseFirestore.WriteBatch, shipmentRef: FirebaseFirestore.DocumentReference, values: { mode: TmsMode; branch: KcplBranch; origin: string; destination: string; actor: Actor; now: string }) {
  const documentPlan = buildDocumentIntelligence({ mode: values.mode, origin: values.origin, destination: values.destination, primaryBranch: values.branch });
  for (const task of defaultWorkflowTasks(values.mode, values.branch)) {
    batch.create(shipmentRef.collection("job_tasks").doc(`task-${crypto.randomUUID()}`), { title: task.title, detail: task.detail, branch: task.branch, due_at: null, assigned_to_uid: null, assigned_to_name: null, assigned_to_email: null, assigned_to_phone: null, completed: false, completed_at: null, completed_by: null, created_at: values.now, created_by: values.actor.email || "workflow@kcpl.internal", workflow_seeded: true });
  }
  for (const step of defaultCustomsSteps(values.mode, values.branch)) {
    batch.create(shipmentRef.collection("customs_steps").doc(`customs-${crypto.randomUUID()}`), { title: step.title, detail: step.detail, branch: step.branch, required: step.required, completed: false, completed_at: null, completed_by: null, created_at: values.now, created_by: values.actor.email || "workflow@kcpl.internal", workflow_seeded: true });
  }
  for (const requirement of documentPlan.requirements) {
    batch.set(shipmentRef.collection("document_requirements").doc(requirement.documentType), { document_type: requirement.documentType, required: requirement.required, reason: requirement.reason, source: requirement.source, advisory: requirement.advisory === true, created_at: values.now, updated_at: values.now });
  }
}

export async function confirmConsolidatedLoadBooking(input: ConsolidatedBookingInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getLoad(input.loadId);
  if (!record) return { kind: "missing_load" as const };
  if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
  if (record.load.master_order_id !== input.masterOrderId) return { kind: "invalid_master" as const };
  if (record.load.status === "booked" && record.load.master_booking_reference === input.bookingReference) {
    const existing = record.load.members.map((member) => member.shipment_reference).filter((value): value is string => Boolean(value));
    return { kind: "booked" as const, masterShipmentReference: nullable(record.data.master_shipment_reference), shipmentReferences: existing };
  }
  if (record.load.status !== "ready_for_procurement" && record.load.status !== "tendering") return { kind: "invalid_transition" as const };
  if (!input.bookingReference.trim()) return { kind: "booking_reference_required" as const };
  if (!Number.isFinite(input.amount) || input.amount < 0 || !crmCurrencies.includes(input.currency)) return { kind: "commercials_required" as const };

  const orders = await loadOrders(record.load.members.map((member) => member.order_id));
  if (orders.length !== record.load.members.length) return { kind: "missing_order" as const };
  if (orders.some((item) => !item.order.customer_id)) return { kind: "customer_required" as const };
  const customerIds = [...new Set(orders.map((item) => item.order.customer_id!.trim().toUpperCase()))];
  const customerRecords = await Promise.all(customerIds.map(async (id) => {
    const ref = firebaseAdminDb().collection("customers").doc(id);
    const snapshot = await ref.get();
    return { id, ref, snapshot };
  }));
  if (customerRecords.some((item) => !item.snapshot.exists || item.snapshot.get("archived") === true)) return { kind: "customer_missing" as const };
  const customerMap = new Map(customerRecords.map((item) => [item.id, item]));
  const allocations = allocateProcurementCost(input.amount, record.load.members);
  if (allocations.length !== record.load.members.length) return { kind: "commercials_required" as const };
  const allocationMap = new Map(allocations.map((item) => [item.order_id, item.amount]));
  const now = new Date().toISOString();
  const masterShipmentReference = shipmentReference("M");
  const masterShipmentRef = firebaseAdminDb().collection("shipments").doc(masterShipmentReference);
  const masterQuoteReference = masterBridgeQuoteReference(record.load.id);
  const masterQuoteRef = firebaseAdminDb().collection("quotes").doc(masterQuoteReference);
  const masterOrderRef = firebaseAdminDb().collection("transport_orders").doc(input.masterOrderId);
  const tenderRef = firebaseAdminDb().collection("transport_tenders").doc(input.tenderId);
  const batch = firebaseAdminDb().batch();

  const firstStop = [...record.load.stops].sort((a, b) => a.sequence - b.sequence)[0];
  const lastStop = [...record.load.stops].sort((a, b) => b.sequence - a.sequence)[0];
  const origin = firstStop?.location ?? record.load.members[0]?.origin ?? "";
  const destination = lastStop?.location ?? record.load.members.at(-1)?.destination ?? "";
  batch.set(masterQuoteRef, { reference: masterQuoteReference, status: "won", migration_hidden: true, source: "tms_consolidation_master_bridge", consolidation_load_id: record.load.id, customer_id: null, company_name: `Consolidation ${record.load.reference}`, contact_name: "", contact_email: "", phone: "", origin, destination, mode: record.load.mode, cargo_type: "Consolidated freight", quote_currency: input.currency, quoted_amount: null, internal_cost: input.amount, shipment_reference: masterShipmentReference, created_at: now, updated_at: now }, { merge: true });
  batch.create(masterShipmentRef, { reference: masterShipmentReference, quote_reference: masterQuoteReference, consolidation_load_id: record.load.id, transport_order_id: input.masterOrderId, tender_id: input.tenderId, tender_reference: input.tenderReference, customer_id: null, primary_branch: record.load.branch, handling_branches: [record.load.branch], origin, destination, mode: record.load.mode, is_consolidation_master: true, house_order_ids: record.load.members.map((member) => member.order_id), job_priority: "standard", job_assigned_to_uid: null, job_assigned_to_name: null, job_assigned_to_email: null, job_assigned_to_phone: null, internal_job_reference: record.load.reference, internal_job_notes: `${record.load.members.length} house orders · ${record.load.stops.length} planned stops`, workflow_version: 1, job_closed_at: null, status: "booking_confirmed", eta: null, current_location: origin, carrier: input.partnerName, carrier_reference: input.bookingReference.trim(), partner_id: input.partnerId, procurement_rate_card_id: input.rateCardId, procurement_cost: input.amount, procurement_currency: input.currency, customer_note: null, created_at: now, updated_at: now });
  const masterEventId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  batch.create(masterShipmentRef.collection("events").doc(String(masterEventId)), { id: masterEventId, shipment_reference: masterShipmentReference, title: "Consolidated booking confirmed", location: origin || null, details: `${record.load.reference} booked with ${input.partnerName}. Master reference: ${input.bookingReference.trim()}.`, event_time: now, created_at: now, author_name: actor.name });
  batch.create(masterShipmentRef.collection("job_activity").doc(eventId("activity")), { type: "consolidation_master_booking", title: `Master load ${record.load.reference} booked`, detail: `${record.load.members.length} house orders · ${input.currency} ${input.amount.toFixed(2)} · ${input.bookingReference.trim()}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
  seedShipmentWorkflow(batch, masterShipmentRef, { mode: record.load.mode, branch: record.load.branch, origin, destination, actor, now });

  const houseShipmentReferences: string[] = [];
  const updatedMembers: TmsLoadMember[] = [];
  const customerShipmentIncrements = new Map<string, number>();
  for (const item of orders) {
    const order = item.order;
    const customerId = order.customer_id!.trim().toUpperCase();
    const customer = customerMap.get(customerId)!;
    const allocation = allocationMap.get(order.id) ?? 0;
    const reference = shipmentReference("S");
    houseShipmentReferences.push(reference);
    const shipmentRef = firebaseAdminDb().collection("shipments").doc(reference);
    const quoteReference = bridgeQuoteReference(order.id);
    const quoteRef = firebaseAdminDb().collection("quotes").doc(quoteReference);
    batch.set(quoteRef, { reference: quoteReference, status: "won", migration_hidden: true, source: "tms_consolidation_house_bridge", transport_order_id: order.id, consolidation_load_id: record.load.id, customer_id: customerId, company_name: text(customer.snapshot.get("display_name"), customerId), contact_name: "", contact_email: text(customer.snapshot.get("primary_email")), phone: text(customer.snapshot.get("primary_phone")), origin: order.origin, destination: order.destination, mode: order.mode, cargo_type: "", quote_currency: text(customer.snapshot.get("preferred_currency"), "NPR"), quoted_amount: null, internal_cost: allocation, shipment_reference: reference, created_at: now, updated_at: now }, { merge: true });
    batch.create(shipmentRef, { reference, quote_reference: quoteReference, transport_order_id: order.id, consolidation_load_id: record.load.id, master_shipment_reference: masterShipmentReference, master_booking_reference: input.bookingReference.trim(), tender_id: input.tenderId, tender_reference: input.tenderReference, customer_id: customerId, primary_branch: order.branch, handling_branches: [order.branch], origin: order.origin, destination: order.destination, mode: order.mode, job_priority: "standard", job_assigned_to_uid: null, job_assigned_to_name: null, job_assigned_to_email: null, job_assigned_to_phone: null, internal_job_reference: order.id, internal_job_notes: order.notes, workflow_version: 1, job_closed_at: null, status: "booking_confirmed", eta: null, current_location: order.origin, carrier: input.partnerName, carrier_reference: input.bookingReference.trim(), partner_id: input.partnerId, procurement_rate_card_id: input.rateCardId, procurement_cost: allocation, procurement_currency: input.currency, customer_note: null, created_at: now, updated_at: now });
    const shipmentEventId = Date.now() * 1000 + Math.floor(Math.random() * 1000) + houseShipmentReferences.length;
    batch.create(shipmentRef.collection("events").doc(String(shipmentEventId)), { id: shipmentEventId, shipment_reference: reference, title: "Booking confirmed under consolidated load", location: order.origin || null, details: `${record.load.reference} · master ${input.bookingReference.trim()} · allocated procurement ${input.currency} ${allocation.toFixed(2)}.`, event_time: now, created_at: now, author_name: actor.name });
    batch.create(shipmentRef.collection("job_activity").doc(eventId("activity")), { type: "consolidation_house_booking", title: `House shipment booked under ${record.load.reference}`, detail: `Master shipment ${masterShipmentReference} · ${input.currency} ${allocation.toFixed(2)} allocated procurement`, actor_name: actor.name, actor_email: actor.email, created_at: now });
    seedShipmentWorkflow(batch, shipmentRef, { mode: order.mode, branch: order.branch, origin: order.origin, destination: order.destination, actor, now });
    batch.update(item.ref, { status: "booked", active_tender_id: null, booking_reference: input.bookingReference.trim(), shipment_reference: reference, selected_cost: allocation, selected_currency: input.currency, consolidation_allocated_cost: allocation, consolidation_allocated_currency: input.currency, procurement_locked_by_load: true, updated_at: now });
    batch.create(item.ref.collection("events").doc(eventId()), { type: "consolidated_booking_confirmed", title: `Booked under master load ${record.load.reference}`, detail: `${reference} · master ${masterShipmentReference} · ${input.currency} ${allocation.toFixed(2)}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
    batch.create(customer.ref.collection("activity").doc(eventId("activity")), { type: "shipment_created", title: `Consolidated shipment opened: ${reference}`, detail: `${order.origin} → ${order.destination} · master load ${record.load.reference}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
    customerShipmentIncrements.set(customerId, (customerShipmentIncrements.get(customerId) ?? 0) + 1);
    const member = record.load.members.find((candidate) => candidate.order_id === order.id)!;
    updatedMembers.push({ ...member, allocated_cost: allocation, allocated_currency: input.currency, shipment_reference: reference });
  }

  for (const [customerId, increment] of customerShipmentIncrements) {
    const customer = customerMap.get(customerId)!;
    const currentActive = Math.max(0, num(customer.snapshot.get("active_shipment_count")));
    const currentStatus = text(customer.snapshot.get("account_status"));
    batch.update(customer.ref, { active_shipment_count: currentActive + increment, lead_stage: "won", ...(currentStatus === "prospect" || currentStatus === "dormant" ? { account_status: "active" } : {}), updated_at: now });
  }

  batch.update(tenderRef, { status: "booked", final_cost: input.amount, final_currency: input.currency, booking_reference: input.bookingReference.trim(), pickup_confirmation: input.pickupConfirmation?.trim() || null, booked_at: now, shipment_reference: masterShipmentReference, consolidation_load_id: record.load.id, shipment_references: houseShipmentReferences, updated_at: now });
  batch.update(masterOrderRef, { status: "booked", active_tender_id: null, booked_tender_id: input.tenderId, booking_reference: input.bookingReference.trim(), shipment_reference: masterShipmentReference, selected_cost: input.amount, selected_currency: input.currency, updated_at: now });
  batch.create(masterOrderRef.collection("events").doc(eventId()), { type: "consolidated_booking_confirmed", title: `Master consolidation booked: ${record.load.reference}`, detail: `${masterShipmentReference} · ${input.currency} ${input.amount.toFixed(2)} · ${input.bookingReference.trim()}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
  batch.update(record.ref, { status: "booked", members: updatedMembers, master_tender_id: input.tenderId, master_booking_reference: input.bookingReference.trim(), master_shipment_reference: masterShipmentReference, procurement_partner_id: input.partnerId, procurement_partner_name: input.partnerName, procurement_cost: input.amount, procurement_currency: input.currency, updated_at: now });
  batch.create(record.ref.collection("events").doc(eventId()), { type: "load_booked", title: `Consolidated load booked with ${input.partnerName}`, detail: `${masterShipmentReference} · ${houseShipmentReferences.length} house shipments · ${input.currency} ${input.amount.toFixed(2)}`, actor_name: actor.name, actor_email: actor.email, created_at: now });

  await batch.commit();
  return { kind: "booked" as const, masterShipmentReference, shipmentReferences: houseShipmentReferences };
}
