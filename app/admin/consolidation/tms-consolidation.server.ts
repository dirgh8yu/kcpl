import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { tmsModes, type TmsMode, type TmsOrder } from "../rating/tms-rating";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { ensureBookingArtifacts, TMS_BOOKING_ARTIFACT_SEED_VERSION } from "../tenders/tms-booking-artifacts.server";
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
  expectedTenderUpdatedAt: string;
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
function bridgeQuoteReference(orderId: string) { return `TMSQ-${orderId.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }
function masterBridgeQuoteReference(id: string) { return `TMSQ-MASTER-${id.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }

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
    prior_selected_currency: currencyValue(data.prior_selected_currency),
    allocated_cost: nullableNum(data.allocated_cost),
    allocated_currency: currencyValue(data.allocated_currency),
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

function loadCapacity(load: TmsConsolidationLoad): LoadCapacity {
  return { weight_kg: load.capacity_weight_kg, volume_cbm: load.capacity_volume_cbm, pieces: load.capacity_pieces, containers: load.capacity_containers };
}

function orderRecord(snapshot: FirebaseFirestore.DocumentSnapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const order = orderFromSnapshot(snapshot.id, data);
  return order ? { ref: snapshot.ref, snapshot, order, data } : null;
}

function loadRecord(snapshot: FirebaseFirestore.DocumentSnapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const load = loadFromData(snapshot.id, data);
  return load ? { ref: snapshot.ref, snapshot, load, data } : null;
}

async function transactionOrderRecords(transaction: FirebaseFirestore.Transaction, ids: string[]) {
  const db = firebaseAdminDb();
  const normalized = [...new Set(ids.map((id) => id.trim().toUpperCase()).filter(Boolean))];
  const snapshots = await Promise.all(normalized.map((id) => transaction.get(db.collection("transport_orders").doc(id))));
  return snapshots.map(orderRecord);
}

function membershipCompatibilityError(message: string) {
  return { ok: false, blockers: [message], warnings: [] as string[] };
}

async function masterTenderIsAuthoritative(transaction: FirebaseFirestore.Transaction, masterOrder: FirebaseFirestore.DocumentSnapshot, tenderId: string, now: string) {
  const pointer = text(masterOrder.get("active_tender_id")).trim().toUpperCase();
  if (pointer) return pointer === tenderId;
  const query = firebaseAdminDb().collection("transport_tenders").where("order_id", "==", masterOrder.id);
  const snapshot = await transaction.get(query);
  const live = snapshot.docs.filter((doc) => {
    const status = text(doc.get("status"));
    if (!["sent", "accepted", "countered"].includes(status)) return false;
    const due = text(doc.get("response_due_at"));
    return !(status === "sent" && due && due <= now);
  });
  return live.length === 1 && live[0].id === tenderId;
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
  const normalizedIds = [...new Set(input.orderIds.map((id) => id.trim().toUpperCase()).filter(Boolean))];
  if (!normalizedIds.length || normalizedIds.length !== input.orderIds.map((id) => id.trim().toUpperCase()).filter(Boolean).length) return { kind: "incompatible" as const, compatibility: membershipCompatibilityError("Each transport order may appear only once in a consolidation load.") };
  const capacity: LoadCapacity = { weight_kg: input.capacityWeightKg ?? null, volume_cbm: input.capacityVolumeCbm ?? null, pieces: input.capacityPieces ?? null, containers: input.capacityContainers ?? null };
  const db = firebaseAdminDb();
  const id = loadId();
  const reference = loadReference();
  const ref = db.collection("consolidation_loads").doc(id);
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const records = await transactionOrderRecords(transaction, normalizedIds);
      if (records.some((record) => !record)) return { kind: "missing_order" as const };
      const ready = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
      const orders = ready.map((record) => record.order);
      if (!orders.length || orders.some((order) => !staffCanAccessBranch(staff, order.branch))) return { kind: "forbidden" as const };
      if (ready.some((record) => nullable(record.data.consolidation_load_id) || record.data.procurement_locked_by_load === true || nullable(record.data.consolidation_master_order_id))) {
        return { kind: "membership_conflict" as const };
      }
      const compatibility = assessLoadCompatibility(orders, input.mode, capacity);
      if (!compatibility.ok) return { kind: "incompatible" as const, compatibility };
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
        master_shipment_reference: null,
        procurement_partner_id: null,
        procurement_partner_name: null,
        procurement_cost: null,
        procurement_currency: null,
        created_at: now,
        created_by_name: actor.name,
        created_by_email: actor.email,
        updated_at: now,
      };
      transaction.create(ref, document);
      transaction.create(ref.collection("events").doc("load-created"), { type: "load_created", title: `${reference} created`, detail: `${orders.length} orders · ${input.mode}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
      for (const record of ready) {
        transaction.update(record.ref, { consolidation_load_id: id, consolidation_reference: reference, updated_at: now });
        transaction.create(record.ref.collection("events").doc(`consolidation-${id}`), { type: "added_to_consolidation", title: `Added to consolidation ${reference}`, detail: input.name.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now });
      }
      return { kind: "created" as const, load: loadFromData(id, document)!, compatibility };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function addOrderToConsolidationLoad(loadIdValue: string, orderIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(loadIdValue.trim().toUpperCase());
  const orderIdValueNormalized = orderIdValue.trim().toUpperCase();
  const orderRef = db.collection("transport_orders").doc(orderIdValueNormalized);
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const loadSnapshot = await transaction.get(loadRef);
      const record = loadRecord(loadSnapshot);
      if (!record) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
      if (record.load.status !== "draft") return { kind: "locked" as const };
      const memberIds = record.load.members.map((member) => member.order_id);
      const snapshots = await Promise.all([
        transaction.get(orderRef),
        ...memberIds.filter((id) => id !== orderIdValueNormalized).map((id) => transaction.get(db.collection("transport_orders").doc(id))),
      ]);
      const order = orderRecord(snapshots[0]);
      if (!order) return { kind: "missing_order" as const };
      if (!staffCanAccessBranch(staff, order.order.branch)) return { kind: "forbidden" as const };
      const alreadyMember = memberIds.includes(orderIdValueNormalized);
      const currentMembership = nullable(order.data.consolidation_load_id);
      if (alreadyMember) {
        if (currentMembership !== record.load.id) return { kind: "state_conflict" as const };
        return { kind: "ready" as const, load: record.load };
      }
      if (currentMembership || order.data.procurement_locked_by_load === true || nullable(order.data.consolidation_master_order_id)) return { kind: "membership_conflict" as const };
      const existing = snapshots.slice(1).map(orderRecord);
      if (existing.some((item) => !item)) return { kind: "state_conflict" as const };
      const existingReady = existing.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (existingReady.some((item) => nullable(item.data.consolidation_load_id) !== record.load.id)) return { kind: "state_conflict" as const };
      const compatibilityOrders = [...existingReady.map((item) => ({ ...item.order, consolidation_load_id: null })), { ...order.order, consolidation_load_id: null }];
      const compatibility = assessLoadCompatibility(compatibilityOrders, record.load.mode, loadCapacity(record.load));
      if (!compatibility.ok) return { kind: "incompatible" as const, compatibility };
      const members = [...existingReady.map((item) => memberFromOrder(item.order)), memberFromOrder(order.order)];
      const stops = buildDefaultStops([...existingReady.map((item) => item.order), order.order]);
      transaction.update(loadRef, { members, stops, updated_at: now });
      transaction.update(orderRef, { consolidation_load_id: record.load.id, consolidation_reference: record.load.reference, updated_at: now });
      transaction.create(loadRef.collection("events").doc(`order-added-${order.order.id}`), { type: "order_added", title: `${order.order.id} added to load`, detail: "Stop sequence was regenerated; review route order before procurement.", actor_name: actor.name, actor_email: actor.email, created_at: now });
      return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, members, stops, updated_at: now })!, compatibility };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function removeOrderFromConsolidationLoad(loadIdValue: string, orderIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(loadIdValue.trim().toUpperCase());
  const normalized = orderIdValue.trim().toUpperCase();
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const record = loadRecord(await transaction.get(loadRef));
      if (!record) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
      if (record.load.status !== "draft") return { kind: "locked" as const };
      if (!record.load.members.some((member) => member.order_id === normalized)) return { kind: "missing_order" as const };
      const remainingIds = record.load.members.map((member) => member.order_id).filter((id) => id !== normalized);
      if (remainingIds.length < 2) return { kind: "minimum_members" as const };
      const ids = [normalized, ...remainingIds];
      const records = await transactionOrderRecords(transaction, ids);
      if (records.some((item) => !item)) return { kind: "state_conflict" as const };
      const ready = records.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (ready.some((item) => nullable(item.data.consolidation_load_id) !== record.load.id)) return { kind: "state_conflict" as const };
      const target = ready.find((item) => item.order.id === normalized)!;
      const remaining = ready.filter((item) => item.order.id !== normalized);
      const members = remaining.map((item) => memberFromOrder(item.order));
      const stops = buildDefaultStops(remaining.map((item) => item.order));
      transaction.update(loadRef, { members, stops, updated_at: now });
      transaction.update(target.ref, { consolidation_load_id: null, consolidation_reference: null, procurement_locked_by_load: false, consolidation_master_order_id: null, updated_at: now });
      transaction.create(loadRef.collection("events").doc(`order-removed-${normalized}`), { type: "order_removed", title: `${normalized} removed from load`, detail: "Stop sequence was regenerated; review route order before procurement.", actor_name: actor.name, actor_email: actor.email, created_at: now });
      return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, members, stops, updated_at: now })! };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function reorderConsolidationStops(loadIdValue: string, orderedStopIds: string[], actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(loadIdValue.trim().toUpperCase());
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const record = loadRecord(await transaction.get(loadRef));
      if (!record) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
      if (record.load.status !== "draft") return { kind: "locked" as const };
      const stops = normalizeStopSequence(record.load.stops, orderedStopIds);
      if (!stops) return { kind: "invalid_sequence" as const };
      const precedence = validateStopPrecedence(stops);
      if (precedence.length) return { kind: "precedence" as const, orderIds: precedence };
      transaction.update(loadRef, { stops, updated_at: now });
      transaction.set(loadRef.collection("events").doc("stops-reordered"), { type: "stops_reordered", title: "Load stop sequence updated", detail: stops.map((stop) => `${stop.sequence}. ${stop.location}`).join(" · "), actor_name: actor.name, actor_email: actor.email, created_at: now }, { merge: true });
      return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, stops, updated_at: now })! };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function updateConsolidationStop(loadIdValue: string, stopIdValue: string, values: { plannedAt?: string; instructions?: string }, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(loadIdValue.trim().toUpperCase());
  const stopId = stopIdValue.trim();
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const record = loadRecord(await transaction.get(loadRef));
      if (!record) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
      if (record.load.status !== "draft") return { kind: "locked" as const };
      if (!record.load.stops.some((stop) => stop.id === stopId)) return { kind: "missing_stop" as const };
      const plannedAtRaw = values.plannedAt?.trim() || "";
      const plannedAt = plannedAtRaw && Number.isFinite(Date.parse(plannedAtRaw)) ? new Date(plannedAtRaw).toISOString() : null;
      const stops = record.load.stops.map((stop) => stop.id === stopId ? { ...stop, planned_at: plannedAt, instructions: values.instructions?.trim() || null } : stop);
      transaction.update(loadRef, { stops, updated_at: now });
      transaction.set(loadRef.collection("events").doc(`stop-${stopId}`), { type: "stop_updated", title: `Stop updated: ${stops.find((stop) => stop.id === stopId)?.location ?? stopId}`, detail: values.instructions?.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now }, { merge: true });
      return { kind: "updated" as const, load: loadFromData(record.load.id, { ...record.data, stops, updated_at: now })! };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function releaseConsolidationToProcurement(loadIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(loadIdValue.trim().toUpperCase());
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const record = loadRecord(await transaction.get(loadRef));
      if (!record) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
      if (record.load.status !== "draft") return record.load.master_order_id ? { kind: "ready" as const, masterOrderId: record.load.master_order_id } : { kind: "locked" as const };
      if (record.load.members.length < 2) return { kind: "minimum_members" as const };
      if (validateStopPrecedence(record.load.stops).length) return { kind: "precedence" as const };
      const records = await transactionOrderRecords(transaction, record.load.members.map((member) => member.order_id));
      if (records.some((item) => !item)) return { kind: "missing_order" as const };
      const ready = records.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (ready.some((item) => !staffCanAccessBranch(staff, item.order.branch))) return { kind: "forbidden" as const };
      if (ready.some((item) => nullable(item.data.consolidation_load_id) !== record.load.id || item.data.procurement_locked_by_load === true || nullable(item.data.consolidation_master_order_id))) return { kind: "state_conflict" as const };
      if (ready.some((item) => !["draft", "rated", "selected"].includes(item.order.status))) return { kind: "state_conflict" as const };
      if (ready.some((item) => !item.order.customer_id)) return { kind: "customer_required" as const };
      const totals = loadTotals(ready.map((item) => item.order));
      const blockers = capacityViolations(totals, loadCapacity(record.load));
      if (blockers.length) return { kind: "capacity" as const, blockers };
      const sortedStops = [...record.load.stops].sort((a, b) => a.sequence - b.sequence);
      const first = sortedStops[0];
      const last = sortedStops.at(-1);
      if (!first || !last) return { kind: "invalid_sequence" as const };
      const id = masterOrderId(record.load.id);
      const masterRef = db.collection("transport_orders").doc(id);
      const existingMaster = await transaction.get(masterRef);
      if (existingMaster.exists) return { kind: "state_conflict" as const };
      const pickupDates = ready.map((item) => item.order.pickup_date).filter((value): value is string => Boolean(value)).sort();
      const deliveryDates = ready.map((item) => item.order.delivery_date).filter((value): value is string => Boolean(value)).sort();
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
        temperature_requirement: ready.map((item) => item.order.temperature_requirement).find(Boolean) ?? null,
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
      transaction.create(masterRef, master);
      transaction.update(loadRef, { status: "ready_for_procurement", master_order_id: id, updated_at: now });
      transaction.create(loadRef.collection("events").doc(`released-${id}`), { type: "released_to_procurement", title: `Master procurement order ${id} created`, detail: `${record.load.members.length} house orders · ${record.load.stops.length} stops`, actor_name: actor.name, actor_email: actor.email, created_at: now });
      for (const item of ready) {
        transaction.update(item.ref, { procurement_locked_by_load: true, consolidation_master_order_id: id, updated_at: now });
        transaction.create(item.ref.collection("events").doc(`procurement-lock-${record.load.id}`), { type: "consolidation_procurement_locked", title: `Procurement moved to master load ${record.load.reference}`, detail: id, actor_name: actor.name, actor_email: actor.email, created_at: now });
      }
      return { kind: "released" as const, masterOrderId: id };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function cancelDraftConsolidationLoad(loadIdValue: string, note: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(loadIdValue.trim().toUpperCase());
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      const record = loadRecord(await transaction.get(loadRef));
      if (!record) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
      if (record.load.status !== "draft") return { kind: "locked" as const };
      const records = await transactionOrderRecords(transaction, record.load.members.map((member) => member.order_id));
      if (records.some((item) => !item)) return { kind: "state_conflict" as const };
      const ready = records.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (ready.some((item) => nullable(item.data.consolidation_load_id) !== record.load.id)) return { kind: "state_conflict" as const };
      transaction.update(loadRef, { status: "cancelled", updated_at: now });
      transaction.create(loadRef.collection("events").doc("load-cancelled"), { type: "load_cancelled", title: "Consolidation load cancelled", detail: note.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now });
      for (const order of ready) transaction.update(order.ref, { consolidation_load_id: null, consolidation_reference: null, procurement_locked_by_load: false, consolidation_master_order_id: null, updated_at: now });
      return { kind: "cancelled" as const };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

function actualTenderCommercials(tender: FirebaseFirestore.DocumentSnapshot) {
  const status = text(tender.get("status"));
  if (status === "accepted") {
    const amount = nullableNum(tender.get("offered_cost"));
    const currency = currencyValue(tender.get("currency"));
    return amount !== null && currency ? { amount, currency } : null;
  }
  if (status === "countered") {
    const amount = nullableNum(tender.get("counter_cost"));
    const currency = currencyValue(tender.get("counter_currency"));
    return amount !== null && currency ? { amount, currency } : null;
  }
  return null;
}

export async function confirmConsolidatedLoadBooking(input: ConsolidatedBookingInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const bookingReference = input.bookingReference.trim();
  if (!bookingReference) return { kind: "booking_reference_required" as const };
  if (!Number.isFinite(input.amount) || input.amount < 0 || !crmCurrencies.includes(input.currency)) return { kind: "commercials_required" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(input.loadId.trim().toUpperCase());
  const masterOrderRef = db.collection("transport_orders").doc(input.masterOrderId.trim().toUpperCase());
  const tenderRef = db.collection("transport_tenders").doc(input.tenderId.trim().toUpperCase());
  const now = new Date().toISOString();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const [loadSnapshot, masterOrder, tender] = await Promise.all([
        transaction.get(loadRef),
        transaction.get(masterOrderRef),
        transaction.get(tenderRef),
      ]);
      const record = loadRecord(loadSnapshot);
      if (!record) return { kind: "missing_load" as const };
      if (!staffCanAccessBranch(staff, record.load.branch)) return { kind: "forbidden" as const };
      if (!masterOrder.exists || record.load.master_order_id !== masterOrder.id) return { kind: "invalid_master" as const };
      if (!tender.exists || text(tender.get("order_id")).trim().toUpperCase() !== masterOrder.id || branchValue(tender.get("branch")) !== record.load.branch) return { kind: "state_conflict" as const };

      if (record.load.status === "booked") {
        const masterShipmentReference = nullable(record.data.master_shipment_reference);
        const houseShipmentReferences = record.load.members.map((member) => member.shipment_reference).filter((value): value is string => Boolean(value));
        if (record.load.master_booking_reference !== bookingReference) return { kind: "booking_conflict" as const };
        if (!masterShipmentReference || houseShipmentReferences.length !== record.load.members.length) return { kind: "state_conflict" as const };
        if (text(tender.get("status")) !== "booked" || text(tender.get("booking_reference")) !== bookingReference || text(tender.get("shipment_reference")).trim().toUpperCase() !== masterShipmentReference.toUpperCase()) return { kind: "state_conflict" as const };
        if (text(masterOrder.get("status")) !== "booked" || text(masterOrder.get("booking_reference")) !== bookingReference || text(masterOrder.get("shipment_reference")).trim().toUpperCase() !== masterShipmentReference.toUpperCase()) return { kind: "state_conflict" as const };
        return { kind: "booked" as const, masterShipmentReference, shipmentReferences: houseShipmentReferences, idempotent: true };
      }
      if (record.load.status !== "ready_for_procurement" && record.load.status !== "tendering") return { kind: "invalid_transition" as const };
      if (text(tender.get("updated_at")) !== input.expectedTenderUpdatedAt) return { kind: "state_conflict" as const };
      if (!await masterTenderIsAuthoritative(transaction, masterOrder, tender.id, now)) return { kind: "stale_tender" as const };
      const commercials = actualTenderCommercials(tender);
      if (!commercials) return { kind: "invalid_transition" as const };
      if (commercials.amount !== input.amount || commercials.currency !== input.currency) return { kind: "state_conflict" as const };
      const partnerId = text(tender.get("partner_id")).trim().toUpperCase();
      const partnerName = text(tender.get("partner_name"), partnerId || "Partner");
      const rateCardId = text(tender.get("rate_card_id"));
      const tenderReference = text(tender.get("tender_reference"), tender.id);
      if (!partnerId || !rateCardId) return { kind: "state_conflict" as const };

      const houseRecordsRaw = await transactionOrderRecords(transaction, record.load.members.map((member) => member.order_id));
      if (houseRecordsRaw.some((item) => !item)) return { kind: "missing_order" as const };
      const houseRecords = houseRecordsRaw.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (houseRecords.some((item) => !item.order.customer_id)) return { kind: "customer_required" as const };
      if (houseRecords.some((item) => nullable(item.data.consolidation_load_id) !== record.load.id || nullable(item.data.consolidation_master_order_id) !== masterOrder.id || item.data.procurement_locked_by_load !== true)) return { kind: "state_conflict" as const };
      if (houseRecords.some((item) => item.order.status === "booked" || nullable(item.data.shipment_reference))) return { kind: "state_conflict" as const };

      const customerIds = [...new Set(houseRecords.map((item) => item.order.customer_id!.trim().toUpperCase()))];
      const customerSnapshots = await Promise.all(customerIds.map((id) => transaction.get(db.collection("customers").doc(id))));
      if (customerSnapshots.some((snapshot) => !snapshot.exists || snapshot.get("archived") === true)) return { kind: "customer_missing" as const };
      const customerMap = new Map(customerSnapshots.map((snapshot) => [snapshot.id, snapshot]));
      const allocations = allocateProcurementCost(commercials.amount, record.load.members);
      if (allocations.length !== record.load.members.length) return { kind: "commercials_required" as const };
      const allocationMap = new Map(allocations.map((item) => [item.order_id, item.amount]));

      const masterShipmentReference = shipmentReference("M");
      const houseReferenceMap = new Map(houseRecords.map((item) => [item.order.id, shipmentReference("S")]));
      const operationId = `consolidation:${record.load.id}:tender:${tender.id}`;
      const sortedStops = [...record.load.stops].sort((a, b) => a.sequence - b.sequence);
      const origin = sortedStops[0]?.location ?? record.load.members[0]?.origin ?? "";
      const destination = sortedStops.at(-1)?.location ?? record.load.members.at(-1)?.destination ?? "";
      const masterShipmentRef = db.collection("shipments").doc(masterShipmentReference);
      const masterQuoteReference = masterBridgeQuoteReference(record.load.id);
      transaction.set(db.collection("quotes").doc(masterQuoteReference), {
        reference: masterQuoteReference,
        status: "won",
        migration_hidden: true,
        source: "tms_consolidation_master_bridge",
        consolidation_load_id: record.load.id,
        customer_id: null,
        company_name: `Consolidation ${record.load.reference}`,
        contact_name: "",
        contact_email: "",
        phone: "",
        origin,
        destination,
        mode: record.load.mode,
        cargo_type: "Consolidated freight",
        quote_currency: commercials.currency,
        quoted_amount: null,
        internal_cost: commercials.amount,
        shipment_reference: masterShipmentReference,
        created_at: now,
        updated_at: now,
      }, { merge: true });
      transaction.create(masterShipmentRef, {
        reference: masterShipmentReference,
        quote_reference: masterQuoteReference,
        consolidation_load_id: record.load.id,
        transport_order_id: masterOrder.id,
        tender_id: tender.id,
        tender_reference: tenderReference,
        customer_id: null,
        primary_branch: record.load.branch,
        handling_branches: [record.load.branch],
        origin,
        destination,
        mode: record.load.mode,
        is_consolidation_master: true,
        house_order_ids: record.load.members.map((member) => member.order_id),
        job_priority: "standard",
        job_assigned_to_uid: null,
        job_assigned_to_name: null,
        job_assigned_to_email: null,
        job_assigned_to_phone: null,
        internal_job_reference: record.load.reference,
        internal_job_notes: `${record.load.members.length} house orders · ${record.load.stops.length} planned stops`,
        workflow_version: 1,
        job_closed_at: null,
        status: "booking_confirmed",
        eta: null,
        current_location: origin,
        carrier: partnerName,
        carrier_reference: bookingReference,
        partner_id: partnerId,
        procurement_rate_card_id: rateCardId,
        procurement_cost: commercials.amount,
        procurement_currency: commercials.currency,
        customer_note: null,
        booking_operation_id: operationId,
        booking_artifact_seed_version: TMS_BOOKING_ARTIFACT_SEED_VERSION,
        booking_artifact_kind: "consolidation_master",
        booking_artifacts_seeded_at: null,
        booking_actor_name: actor.name,
        booking_actor_email: actor.email,
        created_at: now,
        updated_at: now,
      });

      const updatedMembers: TmsLoadMember[] = [];
      const customerIncrements = new Map<string, number>();
      for (const item of houseRecords) {
        const customerId = item.order.customer_id!.trim().toUpperCase();
        const customer = customerMap.get(customerId)!;
        const allocation = allocationMap.get(item.order.id) ?? 0;
        const reference = houseReferenceMap.get(item.order.id)!;
        const quoteReference = bridgeQuoteReference(item.order.id);
        transaction.set(db.collection("quotes").doc(quoteReference), {
          reference: quoteReference,
          status: "won",
          migration_hidden: true,
          source: "tms_consolidation_house_bridge",
          transport_order_id: item.order.id,
          consolidation_load_id: record.load.id,
          customer_id: customerId,
          company_name: text(customer.get("display_name"), customerId),
          contact_name: "",
          contact_email: text(customer.get("primary_email")),
          phone: text(customer.get("primary_phone")),
          origin: item.order.origin,
          destination: item.order.destination,
          mode: item.order.mode,
          cargo_type: "",
          quote_currency: text(customer.get("preferred_currency"), "NPR"),
          quoted_amount: null,
          internal_cost: allocation,
          shipment_reference: reference,
          created_at: now,
          updated_at: now,
        }, { merge: true });
        transaction.create(db.collection("shipments").doc(reference), {
          reference,
          quote_reference: quoteReference,
          transport_order_id: item.order.id,
          consolidation_load_id: record.load.id,
          master_shipment_reference: masterShipmentReference,
          master_booking_reference: bookingReference,
          tender_id: tender.id,
          tender_reference: tenderReference,
          customer_id: customerId,
          primary_branch: item.order.branch,
          handling_branches: [item.order.branch],
          origin: item.order.origin,
          destination: item.order.destination,
          mode: item.order.mode,
          job_priority: "standard",
          job_assigned_to_uid: null,
          job_assigned_to_name: null,
          job_assigned_to_email: null,
          job_assigned_to_phone: null,
          internal_job_reference: item.order.id,
          internal_job_notes: item.order.notes,
          workflow_version: 1,
          job_closed_at: null,
          status: "booking_confirmed",
          eta: null,
          current_location: item.order.origin,
          carrier: partnerName,
          carrier_reference: bookingReference,
          partner_id: partnerId,
          procurement_rate_card_id: rateCardId,
          procurement_cost: allocation,
          procurement_currency: commercials.currency,
          customer_note: null,
          booking_operation_id: operationId,
          booking_artifact_seed_version: TMS_BOOKING_ARTIFACT_SEED_VERSION,
          booking_artifact_kind: "consolidation_house",
          booking_artifacts_seeded_at: null,
          booking_actor_name: actor.name,
          booking_actor_email: actor.email,
          created_at: now,
          updated_at: now,
        });
        transaction.update(item.ref, {
          status: "booked",
          active_tender_id: null,
          booking_reference: bookingReference,
          shipment_reference: reference,
          selected_cost: allocation,
          selected_currency: commercials.currency,
          consolidation_allocated_cost: allocation,
          consolidation_allocated_currency: commercials.currency,
          procurement_locked_by_load: true,
          booking_operation_id: operationId,
          updated_at: now,
        });
        transaction.create(item.ref.collection("events").doc(`booking-${reference}`), { type: "consolidated_booking_confirmed", title: `Booked under master load ${record.load.reference}`, detail: `${reference} · master ${masterShipmentReference} · ${commercials.currency} ${allocation.toFixed(2)}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
        customerIncrements.set(customerId, (customerIncrements.get(customerId) ?? 0) + 1);
        const member = record.load.members.find((candidate) => candidate.order_id === item.order.id)!;
        updatedMembers.push({ ...member, allocated_cost: allocation, allocated_currency: commercials.currency, shipment_reference: reference });
      }

      for (const [customerId, increment] of customerIncrements) {
        const customer = customerMap.get(customerId)!;
        const currentActive = Math.max(0, num(customer.get("active_shipment_count")));
        const currentStatus = text(customer.get("account_status"));
        transaction.update(customer.ref, { active_shipment_count: currentActive + increment, lead_stage: "won", ...(currentStatus === "prospect" || currentStatus === "dormant" ? { account_status: "active" } : {}), updated_at: now });
      }

      const houseShipmentReferences = houseRecords.map((item) => houseReferenceMap.get(item.order.id)!);
      transaction.update(tenderRef, {
        status: "booked",
        final_cost: commercials.amount,
        final_currency: commercials.currency,
        booking_reference: bookingReference,
        pickup_confirmation: input.pickupConfirmation?.trim() || null,
        booked_at: now,
        shipment_reference: masterShipmentReference,
        consolidation_load_id: record.load.id,
        shipment_references: houseShipmentReferences,
        booking_operation_id: operationId,
        updated_at: now,
      });
      transaction.update(masterOrderRef, {
        status: "booked",
        active_tender_id: null,
        booked_tender_id: tender.id,
        booking_reference: bookingReference,
        shipment_reference: masterShipmentReference,
        selected_cost: commercials.amount,
        selected_currency: commercials.currency,
        booking_operation_id: operationId,
        updated_at: now,
      });
      transaction.create(masterOrderRef.collection("events").doc(`booking-${masterShipmentReference}`), { type: "consolidated_booking_confirmed", title: `Master consolidation booked: ${record.load.reference}`, detail: `${masterShipmentReference} · ${commercials.currency} ${commercials.amount.toFixed(2)} · ${bookingReference}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
      transaction.update(loadRef, {
        status: "booked",
        members: updatedMembers,
        master_tender_id: tender.id,
        master_booking_reference: bookingReference,
        master_shipment_reference: masterShipmentReference,
        procurement_partner_id: partnerId,
        procurement_partner_name: partnerName,
        procurement_cost: commercials.amount,
        procurement_currency: commercials.currency,
        booking_operation_id: operationId,
        updated_at: now,
      });
      transaction.create(loadRef.collection("events").doc(`booking-${masterShipmentReference}`), { type: "load_booked", title: `Consolidated load booked with ${partnerName}`, detail: `${masterShipmentReference} · ${houseShipmentReferences.length} house shipments · ${commercials.currency} ${commercials.amount.toFixed(2)}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
      return { kind: "booked" as const, masterShipmentReference, shipmentReferences: houseShipmentReferences, idempotent: false };
    });

    if (result.kind === "booked") {
      for (const reference of [result.masterShipmentReference, ...result.shipmentReferences]) await ensureBookingArtifacts(reference, actor);
    }
    return result;
  } catch {
    return { kind: "unavailable" as const };
  }
}
