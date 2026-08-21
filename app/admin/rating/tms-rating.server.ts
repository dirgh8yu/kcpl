import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  rateOrder,
  tmsModes,
  tmsRateUnits,
  type PartnerBuyRateCard,
  type RatingResult,
  type TmsMode,
  type TmsOrder,
  type TmsRateUnit,
} from "./tms-rating";

type Actor = { name: string; email: string };

export type TmsOrderInput = {
  branch: KcplBranch;
  customerId?: string;
  customerName?: string;
  origin: string;
  destination: string;
  mode: TmsMode;
  pickupDate?: string;
  deliveryDate?: string;
  weightKg: number;
  volumeCbm: number;
  pieces: number;
  containerCount: number;
  equipment?: string;
  temperatureRequirement?: string;
  carrierRequirement?: string;
  notes?: string;
};

export type PartnerBuyRateInput = {
  partnerId: string;
  branch: KcplBranch | "Global";
  origin: string;
  destination: string;
  mode: TmsMode;
  service?: string;
  equipment?: string;
  currency: CrmCurrency;
  rate: number;
  unit: TmsRateUnit;
  minimumCharge?: number | null;
  fuelSurchargePercent: number;
  accessorialFlat: number;
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
  active: boolean;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function orderId() { return `ORD-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`; }
function rateId() { return `BUY-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`; }
function eventId() { return `evt-${Date.now()}-${randomBytes(4).toString("hex")}`; }
function validMode(value: unknown): TmsMode { return tmsModes.includes(value as TmsMode) ? value as TmsMode : "road"; }
function validUnit(value: unknown): TmsRateUnit { return tmsRateUnits.includes(value as TmsRateUnit) ? value as TmsRateUnit : "flat"; }
function validCurrency(value: unknown): CrmCurrency { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : "NPR"; }
function validBranch(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function validDate(value: unknown) { const raw = text(value).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null; }

function orderFromData(id: string, data: Record<string, unknown>): TmsOrder | null {
  const branch = validBranch(data.branch);
  if (!branch) return null;
  const selectedCurrency = nullable(data.selected_currency);
  return {
    id,
    branch,
    customer_id: nullable(data.customer_id),
    customer_name: nullable(data.customer_name),
    origin: text(data.origin),
    destination: text(data.destination),
    mode: validMode(data.mode),
    pickup_date: validDate(data.pickup_date),
    delivery_date: validDate(data.delivery_date),
    weight_kg: Math.max(0, numberValue(data.weight_kg)),
    volume_cbm: Math.max(0, numberValue(data.volume_cbm)),
    pieces: Math.max(0, Math.trunc(numberValue(data.pieces))),
    container_count: Math.max(0, Math.trunc(numberValue(data.container_count))),
    equipment: nullable(data.equipment),
    temperature_requirement: nullable(data.temperature_requirement),
    carrier_requirement: nullable(data.carrier_requirement),
    notes: nullable(data.notes),
    status: ["draft", "rated", "selected", "cancelled"].includes(text(data.status)) ? text(data.status) as TmsOrder["status"] : "draft",
    selected_rate_card_id: nullable(data.selected_rate_card_id),
    selected_partner_id: nullable(data.selected_partner_id),
    selected_cost: nullableNumber(data.selected_cost),
    selected_currency: selectedCurrency && crmCurrencies.includes(selectedCurrency as CrmCurrency) ? selectedCurrency as CrmCurrency : null,
    created_at: text(data.created_at),
    created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email),
    updated_at: text(data.updated_at),
  };
}

function cardFromData(id: string, data: Record<string, unknown>): PartnerBuyRateCard | null {
  const branchRaw = text(data.branch);
  const branch = branchRaw === "Global" ? "Global" : validBranch(branchRaw);
  if (!branch) return null;
  const currency = validCurrency(data.currency);
  return {
    id,
    partner_id: text(data.partner_id).trim().toUpperCase(),
    partner_name: text(data.partner_name, "Partner"),
    branch,
    origin: text(data.origin),
    destination: text(data.destination),
    mode: validMode(data.mode),
    service: nullable(data.service),
    equipment: nullable(data.equipment),
    currency,
    rate: Math.max(0, numberValue(data.rate)),
    unit: validUnit(data.unit),
    minimum_charge: nullableNumber(data.minimum_charge),
    fuel_surcharge_percent: Math.max(0, numberValue(data.fuel_surcharge_percent)),
    accessorial_flat: Math.max(0, numberValue(data.accessorial_flat)),
    transit_days_min: nullableNumber(data.transit_days_min),
    transit_days_max: nullableNumber(data.transit_days_max),
    valid_from: validDate(data.valid_from),
    valid_until: validDate(data.valid_until),
    active: data.active !== false,
    notes: nullable(data.notes),
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
  };
}

function canAccessOrder(staff: KcplStaffContext, order: TmsOrder) {
  return staffCanAccessBranch(staff, order.branch);
}

function canAccessRateCard(staff: KcplStaffContext, card: PartnerBuyRateCard) {
  return card.branch === "Global" || staffCanAccessBranch(staff, card.branch);
}

export async function listTmsOrders(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("transport_orders").orderBy("updated_at", "desc").limit(500).get();
  const orders = snapshot.docs.map((doc) => orderFromData(doc.id, doc.data() as Record<string, unknown>)).filter((order): order is TmsOrder => Boolean(order));
  return { kind: "ready" as const, orders: orders.filter((order) => canAccessOrder(staff, order)) };
}

export async function createTmsOrder(input: TmsOrderInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staffCanAccessBranch(staff, input.branch)) return { kind: "forbidden" as const };
  if (!tmsModes.includes(input.mode) || !input.origin.trim() || !input.destination.trim()) return { kind: "invalid" as const };
  if (![input.weightKg, input.volumeCbm, input.pieces, input.containerCount].every((value) => Number.isFinite(value) && value >= 0)) return { kind: "invalid" as const };
  const id = orderId();
  const now = new Date().toISOString();
  const data = {
    branch: input.branch,
    customer_id: input.customerId?.trim().toUpperCase() || null,
    customer_name: input.customerName?.trim() || null,
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    mode: input.mode,
    pickup_date: input.pickupDate || null,
    delivery_date: input.deliveryDate || null,
    weight_kg: input.weightKg,
    volume_cbm: input.volumeCbm,
    pieces: Math.trunc(input.pieces),
    container_count: Math.trunc(input.containerCount),
    equipment: input.equipment?.trim() || null,
    temperature_requirement: input.temperatureRequirement?.trim() || null,
    carrier_requirement: input.carrierRequirement?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "draft",
    selected_rate_card_id: null,
    selected_partner_id: null,
    selected_cost: null,
    selected_currency: null,
    created_at: now,
    created_by_name: actor.name,
    created_by_email: actor.email,
    updated_at: now,
  };
  const ref = firebaseAdminDb().collection("transport_orders").doc(id);
  const batch = firebaseAdminDb().batch();
  batch.create(ref, data);
  batch.create(ref.collection("events").doc(eventId()), { type: "order_created", title: "Transport order created", actor_name: actor.name, actor_email: actor.email, created_at: now });
  await batch.commit();
  return { kind: "created" as const, order: orderFromData(id, data)! };
}

export async function listPartnerBuyRateCards(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("partner_rate_cards").orderBy("updated_at", "desc").limit(1500).get();
  const cards = snapshot.docs.map((doc) => cardFromData(doc.id, doc.data() as Record<string, unknown>)).filter((card): card is PartnerBuyRateCard => Boolean(card));
  return { kind: "ready" as const, rateCards: cards.filter((card) => canAccessRateCard(staff, card)) };
}

export async function createPartnerBuyRateCard(input: PartnerBuyRateInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canManageRateCards) return { kind: "forbidden" as const };
  if (!tmsModes.includes(input.mode) || !tmsRateUnits.includes(input.unit) || !crmCurrencies.includes(input.currency)) return { kind: "invalid" as const };
  if (!input.origin.trim() || !input.destination.trim() || !Number.isFinite(input.rate) || input.rate < 0) return { kind: "invalid" as const };
  if (input.branch !== "Global" && !staffCanAccessBranch(staff, input.branch)) return { kind: "forbidden" as const };

  const partnerId = input.partnerId.trim().toUpperCase();
  const partner = await firebaseAdminDb().collection("partners").doc(partnerId).get();
  if (!partner.exists || partner.get("status") === "inactive") return { kind: "missing_partner" as const };
  const ownerBranch = text(partner.get("owner_branch"));
  if (ownerBranch && ownerBranch !== "Global" && (!validBranch(ownerBranch) || !staffCanAccessBranch(staff, ownerBranch))) return { kind: "forbidden" as const };

  const id = rateId();
  const now = new Date().toISOString();
  const data = {
    partner_id: partnerId,
    partner_name: text(partner.get("display_name"), partnerId),
    branch: input.branch,
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    mode: input.mode,
    service: input.service?.trim() || null,
    equipment: input.equipment?.trim() || null,
    currency: input.currency,
    rate: input.rate,
    unit: input.unit,
    minimum_charge: input.minimumCharge ?? null,
    fuel_surcharge_percent: Math.max(0, input.fuelSurchargePercent),
    accessorial_flat: Math.max(0, input.accessorialFlat),
    transit_days_min: input.transitDaysMin ?? null,
    transit_days_max: input.transitDaysMax ?? null,
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
    active: input.active,
    notes: input.notes?.trim() || null,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };
  await firebaseAdminDb().collection("partner_rate_cards").doc(id).create(data);
  return { kind: "created" as const, rateCard: cardFromData(id, data)! };
}

async function getOrder(id: string, staff: KcplStaffContext) {
  const ref = firebaseAdminDb().collection("transport_orders").doc(id.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const order = orderFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (!order) return { kind: "invalid" as const };
  if (!canAccessOrder(staff, order)) return { kind: "forbidden" as const };
  return { kind: "ready" as const, order, ref };
}

export async function rateTmsOrder(id: string, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const orderResult = await getOrder(id, staff);
  if (orderResult.kind !== "ready") return orderResult;
  const rates = await listPartnerBuyRateCards(staff);
  if (rates.kind !== "ready") return rates;
  const results = rateOrder(orderResult.order, rates.rateCards);
  await orderResult.ref.update({ status: orderResult.order.status === "selected" ? "selected" : "rated", updated_at: new Date().toISOString() });
  return { kind: "ready" as const, order: orderResult.order, results };
}

export async function selectTmsRate(id: string, rateCardId: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const orderResult = await getOrder(id, staff);
  if (orderResult.kind !== "ready") return orderResult;
  const rates = await listPartnerBuyRateCards(staff);
  if (rates.kind !== "ready") return rates;
  const result = rateOrder(orderResult.order, rates.rateCards).find((item) => item.rate_card_id === rateCardId) as RatingResult | undefined;
  if (!result) return { kind: "rate_unavailable" as const };
  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(orderResult.ref, {
    status: "selected",
    selected_rate_card_id: result.rate_card_id,
    selected_partner_id: result.partner_id,
    selected_cost: result.total_cost,
    selected_currency: result.currency,
    updated_at: now,
  });
  batch.create(orderResult.ref.collection("events").doc(eventId()), {
    type: "rate_selected",
    title: `Rate selected: ${result.partner_name}`,
    detail: `${result.currency} ${result.total_cost.toFixed(2)} · ${result.mode}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "selected" as const, result };
}
