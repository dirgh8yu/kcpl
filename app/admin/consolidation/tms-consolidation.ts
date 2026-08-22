import type { CrmCurrency, KcplBranch } from "../crm/crm-data";
import type { TmsMode, TmsOrder } from "../rating/tms-rating";

export const tmsLoadStatuses = ["draft", "ready_for_procurement", "tendering", "booked", "cancelled"] as const;
export type TmsLoadStatus = (typeof tmsLoadStatuses)[number];

export const tmsLoadStopKinds = ["pickup", "hub", "customs", "delivery"] as const;
export type TmsLoadStopKind = (typeof tmsLoadStopKinds)[number];

export const MAX_LOAD_ORDERS = 20;

export type TmsLoadStop = {
  id: string;
  sequence: number;
  kind: TmsLoadStopKind;
  location: string;
  order_ids: string[];
  planned_at: string | null;
  instructions: string | null;
};

export type TmsLoadMember = {
  order_id: string;
  customer_id: string | null;
  customer_name: string | null;
  origin: string;
  destination: string;
  mode: TmsMode;
  weight_kg: number;
  volume_cbm: number;
  pieces: number;
  container_count: number;
  equipment: string | null;
  temperature_requirement: string | null;
  prior_selected_cost: number | null;
  prior_selected_currency: CrmCurrency | null;
  allocated_cost: number | null;
  allocated_currency: CrmCurrency | null;
  shipment_reference: string | null;
};

export type TmsConsolidationLoad = {
  id: string;
  reference: string;
  name: string;
  branch: KcplBranch;
  mode: TmsMode;
  status: TmsLoadStatus;
  equipment: string | null;
  capacity_weight_kg: number | null;
  capacity_volume_cbm: number | null;
  capacity_pieces: number | null;
  capacity_containers: number | null;
  members: TmsLoadMember[];
  stops: TmsLoadStop[];
  master_order_id: string | null;
  master_tender_id: string | null;
  master_booking_reference: string | null;
  procurement_partner_id: string | null;
  procurement_partner_name: string | null;
  procurement_cost: number | null;
  procurement_currency: CrmCurrency | null;
  created_at: string;
  created_by_name: string;
  created_by_email: string;
  updated_at: string;
};

export type LoadCapacity = {
  weight_kg: number | null;
  volume_cbm: number | null;
  pieces: number | null;
  containers: number | null;
};

export type LoadTotals = {
  weight_kg: number;
  volume_cbm: number;
  pieces: number;
  containers: number;
};

export type LoadCompatibility = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
};

function key(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizedId(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function positiveOrNull(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
}

export type ConsolidationMembershipDecision = "add" | "ready" | "locked" | "membership_conflict" | "state_conflict";

export function consolidationMembershipDecision(input: {
  loadStatus: TmsLoadStatus;
  targetLoadId: string;
  loadMemberIds: string[];
  orderId: string;
  orderLoadId?: string | null;
  procurementLocked?: boolean;
  consolidationMasterOrderId?: string | null;
}): ConsolidationMembershipDecision {
  if (input.loadStatus !== "draft") return "locked";
  const target = normalizedId(input.targetLoadId);
  const orderId = normalizedId(input.orderId);
  const members = new Set(input.loadMemberIds.map(normalizedId).filter(Boolean));
  const orderLoad = normalizedId(input.orderLoadId);
  const loadHasOrder = members.has(orderId);
  if (loadHasOrder) return orderLoad === target && !input.procurementLocked && !normalizedId(input.consolidationMasterOrderId) ? "ready" : "state_conflict";
  if (orderLoad || input.procurementLocked || normalizedId(input.consolidationMasterOrderId)) return "membership_conflict";
  return "add";
}

export function consolidationMembershipConsistent(loadId: string, memberIds: string[], orderMemberships: Array<{ orderId: string; loadId?: string | null }>) {
  const target = normalizedId(loadId);
  const members = [...new Set(memberIds.map(normalizedId).filter(Boolean))].sort();
  const owned = orderMemberships
    .filter((item) => normalizedId(item.loadId) === target)
    .map((item) => normalizedId(item.orderId))
    .filter(Boolean)
    .sort();
  return members.length === owned.length && members.every((id, index) => id === owned[index]);
}

export type ConsolidatedBookingRetryDecision = "idempotent" | "booking_conflict" | "state_conflict";

export function consolidatedBookingRetryDecision(input: {
  requestedBookingReference: string;
  loadBookingReference?: string | null;
  masterShipmentReference?: string | null;
  memberShipmentReferences: Array<string | null | undefined>;
  expectedMemberCount: number;
  tenderStatus: string;
  tenderBookingReference?: string | null;
  tenderShipmentReference?: string | null;
  masterOrderStatus: string;
  masterOrderBookingReference?: string | null;
  masterOrderShipmentReference?: string | null;
}): ConsolidatedBookingRetryDecision {
  const requested = input.requestedBookingReference.trim();
  if (!requested || (input.loadBookingReference ?? "").trim() !== requested) return "booking_conflict";
  const master = normalizedId(input.masterShipmentReference);
  const houses = input.memberShipmentReferences.map(normalizedId).filter(Boolean);
  if (!master || houses.length !== input.expectedMemberCount || new Set(houses).size !== houses.length) return "state_conflict";
  if (input.tenderStatus !== "booked" || (input.tenderBookingReference ?? "").trim() !== requested || normalizedId(input.tenderShipmentReference) !== master) return "state_conflict";
  if (input.masterOrderStatus !== "booked" || (input.masterOrderBookingReference ?? "").trim() !== requested || normalizedId(input.masterOrderShipmentReference) !== master) return "state_conflict";
  return "idempotent";
}

export function orderEligibleForConsolidation(order: TmsOrder & { consolidation_load_id?: string | null; is_consolidation_master?: boolean }) {
  if (order.is_consolidation_master) return false;
  if (order.consolidation_load_id) return false;
  return order.status === "draft" || order.status === "rated" || order.status === "selected";
}

export function loadTotals(orders: Array<Pick<TmsOrder, "weight_kg" | "volume_cbm" | "pieces" | "container_count">>): LoadTotals {
  return orders.reduce((total, order) => ({
    weight_kg: total.weight_kg + Math.max(0, order.weight_kg),
    volume_cbm: total.volume_cbm + Math.max(0, order.volume_cbm),
    pieces: total.pieces + Math.max(0, order.pieces),
    containers: total.containers + Math.max(0, order.container_count),
  }), { weight_kg: 0, volume_cbm: 0, pieces: 0, containers: 0 });
}

export function capacityViolations(totals: LoadTotals, capacity: LoadCapacity) {
  const blockers: string[] = [];
  const weight = positiveOrNull(capacity.weight_kg);
  const volume = positiveOrNull(capacity.volume_cbm);
  const pieces = positiveOrNull(capacity.pieces);
  const containers = positiveOrNull(capacity.containers);
  if (weight !== null && totals.weight_kg > weight) blockers.push(`Weight exceeds capacity by ${(totals.weight_kg - weight).toFixed(2)} kg.`);
  if (volume !== null && totals.volume_cbm > volume) blockers.push(`Volume exceeds capacity by ${(totals.volume_cbm - volume).toFixed(3)} CBM.`);
  if (pieces !== null && totals.pieces > pieces) blockers.push(`Pieces exceed capacity by ${Math.ceil(totals.pieces - pieces)}.`);
  if (containers !== null && totals.containers > containers) blockers.push(`Container count exceeds capacity by ${Math.ceil(totals.containers - containers)}.`);
  return blockers;
}

export function assessLoadCompatibility(
  orders: Array<TmsOrder & { consolidation_load_id?: string | null; is_consolidation_master?: boolean }>,
  requestedMode: TmsMode,
  capacity: LoadCapacity,
): LoadCompatibility {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (orders.length < 2) blockers.push("A consolidation load requires at least two transport orders.");
  if (orders.length > MAX_LOAD_ORDERS) blockers.push(`A consolidation load can contain at most ${MAX_LOAD_ORDERS} orders.`);
  if (orders.some((order) => !orderEligibleForConsolidation(order))) blockers.push("Every order must be draft, rated or selected and not already assigned to another load.");

  const branches = new Set(orders.map((order) => order.branch));
  if (branches.size > 1) blockers.push("All orders in a load must belong to the same KCPL branch.");

  const modes = new Set(orders.map((order) => order.mode));
  if (requestedMode !== "multimodal" && (modes.size > 1 || !modes.has(requestedMode))) {
    blockers.push("A single-mode load can only contain orders of that same transport mode.");
  }
  if (requestedMode === "multimodal" && modes.size === 1) warnings.push("All selected orders use one mode; a single-mode load may be simpler than multimodal planning.");

  const equipment = new Set(orders.map((order) => key(order.equipment)).filter(Boolean));
  if (equipment.size > 1) blockers.push("Orders have conflicting equipment requirements.");
  const temperature = new Set(orders.map((order) => key(order.temperature_requirement)).filter(Boolean));
  if (temperature.size > 1) blockers.push("Orders have conflicting temperature requirements.");

  const totals = loadTotals(orders);
  blockers.push(...capacityViolations(totals, capacity));

  const selectedCurrencies = new Set(orders.map((order) => order.selected_currency).filter(Boolean));
  if (selectedCurrencies.size > 1) warnings.push("Member orders contain selected procurement costs in multiple currencies; savings cannot be combined without explicit FX conversion.");
  if (orders.some((order) => !order.customer_id)) warnings.push("Every member order must be linked to a KCPL customer before the load can be released to procurement.");

  return { ok: blockers.length === 0, blockers, warnings };
}

export function buildDefaultStops(orders: Array<Pick<TmsOrder, "id" | "origin" | "destination">>): TmsLoadStop[] {
  const pickups = new Map<string, { location: string; orderIds: string[] }>();
  const deliveries = new Map<string, { location: string; orderIds: string[] }>();
  for (const order of orders) {
    const originKey = key(order.origin);
    const destinationKey = key(order.destination);
    const pickup = pickups.get(originKey) ?? { location: order.origin.trim(), orderIds: [] };
    pickup.orderIds.push(order.id);
    pickups.set(originKey, pickup);
    const delivery = deliveries.get(destinationKey) ?? { location: order.destination.trim(), orderIds: [] };
    delivery.orderIds.push(order.id);
    deliveries.set(destinationKey, delivery);
  }
  const stops: TmsLoadStop[] = [];
  for (const item of pickups.values()) stops.push({ id: `PU-${stops.length + 1}`, sequence: stops.length + 1, kind: "pickup", location: item.location, order_ids: item.orderIds, planned_at: null, instructions: null });
  for (const item of deliveries.values()) stops.push({ id: `DL-${stops.length + 1}`, sequence: stops.length + 1, kind: "delivery", location: item.location, order_ids: item.orderIds, planned_at: null, instructions: null });
  return stops;
}

export function normalizeStopSequence(stops: TmsLoadStop[], orderedIds: string[]) {
  if (orderedIds.length !== stops.length || new Set(orderedIds).size !== stops.length) return null;
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const reordered = orderedIds.map((id) => byId.get(id));
  if (reordered.some((stop) => !stop)) return null;
  return reordered.map((stop, index) => ({ ...stop!, sequence: index + 1 }));
}

export function validateStopPrecedence(stops: TmsLoadStop[]) {
  const firstPickup = new Map<string, number>();
  const firstDelivery = new Map<string, number>();
  for (const stop of [...stops].sort((a, b) => a.sequence - b.sequence)) {
    for (const orderId of stop.order_ids) {
      if (stop.kind === "pickup" && !firstPickup.has(orderId)) firstPickup.set(orderId, stop.sequence);
      if (stop.kind === "delivery" && !firstDelivery.has(orderId)) firstDelivery.set(orderId, stop.sequence);
    }
  }
  const invalid: string[] = [];
  for (const [orderId, deliverySequence] of firstDelivery) {
    const pickupSequence = firstPickup.get(orderId);
    if (pickupSequence === undefined || pickupSequence >= deliverySequence) invalid.push(orderId);
  }
  return invalid;
}

export function allocationBasis(orders: TmsLoadMember[]) {
  const weight = orders.reduce((sum, order) => sum + Math.max(0, order.weight_kg), 0);
  if (weight > 0) return { field: "weight_kg" as const, total: weight };
  const volume = orders.reduce((sum, order) => sum + Math.max(0, order.volume_cbm), 0);
  if (volume > 0) return { field: "volume_cbm" as const, total: volume };
  const pieces = orders.reduce((sum, order) => sum + Math.max(0, order.pieces), 0);
  if (pieces > 0) return { field: "pieces" as const, total: pieces };
  return { field: "equal" as const, total: orders.length };
}

export function allocateProcurementCost(totalCost: number, orders: TmsLoadMember[]) {
  if (!Number.isFinite(totalCost) || totalCost < 0 || !orders.length) return [] as Array<{ order_id: string; amount: number }>;
  const basis = allocationBasis(orders);
  let allocatedCents = 0;
  const totalCents = Math.round(totalCost * 100);
  return orders.map((order, index) => {
    let cents: number;
    if (index === orders.length - 1) cents = totalCents - allocatedCents;
    else {
      const value = basis.field === "equal" ? 1 : Math.max(0, order[basis.field]);
      cents = Math.round(totalCents * (value / Math.max(1, basis.total)));
      cents = Math.max(0, Math.min(cents, totalCents - allocatedCents));
    }
    allocatedCents += cents;
    return { order_id: order.order_id, amount: cents / 100 };
  });
}

export function selectedCostBaselines(members: TmsLoadMember[]) {
  const totals: Partial<Record<CrmCurrency, number>> = {};
  for (const member of members) {
    if (member.prior_selected_cost === null || !member.prior_selected_currency) continue;
    totals[member.prior_selected_currency] = (totals[member.prior_selected_currency] ?? 0) + member.prior_selected_cost;
  }
  return totals;
}

export function consolidationSavings(load: Pick<TmsConsolidationLoad, "members" | "procurement_cost" | "procurement_currency">) {
  if (load.procurement_cost === null || !load.procurement_currency) return null;
  const comparable = load.members.filter((member) => member.prior_selected_cost !== null && member.prior_selected_currency === load.procurement_currency);
  if (comparable.length !== load.members.length) return null;
  const baseline = comparable.reduce((sum, member) => sum + (member.prior_selected_cost ?? 0), 0);
  return { baseline, consolidated: load.procurement_cost, savings: baseline - load.procurement_cost };
}
