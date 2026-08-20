import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, type CrmCurrency } from "./crm-data";
import { crmRateModes, crmRateUnits, type CrmRateCard, type CrmRateCardInput, type CrmRateMode, type CrmRateUnit } from "./crm-rate-cards";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const cleaned = text(value).trim();
  return cleaned || null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rateMode(value: unknown): CrmRateMode {
  return crmRateModes.includes(value as CrmRateMode) ? value as CrmRateMode : "road";
}

function rateUnit(value: unknown): CrmRateUnit {
  return crmRateUnits.includes(value as CrmRateUnit) ? value as CrmRateUnit : "flat";
}

function currency(value: unknown): CrmCurrency {
  return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : "NPR";
}

function rateId() {
  return `rate-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function activityId() {
  return `activity-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function rateFromData(id: string, customerId: string, data: Record<string, unknown>): CrmRateCard {
  return {
    id,
    customer_id: customerId,
    origin: text(data.origin),
    destination: text(data.destination),
    mode: rateMode(data.mode),
    carrier: nullable(data.carrier),
    service: nullable(data.service),
    currency: currency(data.currency),
    cost_rate: nullableNumber(data.cost_rate),
    sell_rate: nullableNumber(data.sell_rate) ?? 0,
    unit: rateUnit(data.unit),
    minimum_charge: nullableNumber(data.minimum_charge),
    valid_from: nullable(data.valid_from),
    valid_until: nullable(data.valid_until),
    notes: nullable(data.notes),
    active: data.active !== false,
    created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email),
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
  };
}

async function customerRef(customerId: string) {
  const id = customerId.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("customers").doc(id);
  const snapshot = await ref.get();
  return snapshot.exists && snapshot.get("archived") !== true ? { id, ref } : null;
}

export async function listCrmRateCards(customerId: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };
  const snapshot = await customer.ref.collection("rate_cards").orderBy("updated_at", "desc").limit(500).get();
  return {
    kind: "ready" as const,
    rateCards: snapshot.docs.map((doc) => rateFromData(doc.id, customer.id, doc.data() as Record<string, unknown>)),
  };
}

export async function createCrmRateCard(customerId: string, input: CrmRateCardInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };
  const id = rateId();
  const now = new Date().toISOString();
  const data = {
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    mode: input.mode,
    carrier: input.carrier.trim() || null,
    service: input.service.trim() || null,
    currency: input.currency,
    cost_rate: input.costRate,
    sell_rate: input.sellRate,
    unit: input.unit,
    minimum_charge: input.minimumCharge,
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
    notes: input.notes.trim() || null,
    active: input.active,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };
  const batch = firebaseAdminDb().batch();
  batch.create(customer.ref.collection("rate_cards").doc(id), data);
  batch.update(customer.ref, { updated_at: now });
  batch.create(customer.ref.collection("activity").doc(activityId()), {
    type: "rate_card_created",
    title: `Rate card added: ${data.origin} → ${data.destination}`,
    detail: `${input.currency} ${input.sellRate} ${input.unit.replaceAll("_", " ")}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "created" as const, rateCard: rateFromData(id, customer.id, data) };
}

export async function updateCrmRateCard(customerId: string, rateCardId: string, input: CrmRateCardInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };
  const rateRef = customer.ref.collection("rate_cards").doc(rateCardId);
  const snapshot = await rateRef.get();
  if (!snapshot.exists) return { kind: "missing_rate" as const };
  const now = new Date().toISOString();
  const update = {
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    mode: input.mode,
    carrier: input.carrier.trim() || null,
    service: input.service.trim() || null,
    currency: input.currency,
    cost_rate: input.costRate,
    sell_rate: input.sellRate,
    unit: input.unit,
    minimum_charge: input.minimumCharge,
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
    notes: input.notes.trim() || null,
    active: input.active,
    updated_at: now,
  };
  const batch = firebaseAdminDb().batch();
  batch.update(rateRef, update);
  batch.update(customer.ref, { updated_at: now });
  batch.create(customer.ref.collection("activity").doc(activityId()), {
    type: "rate_card_updated",
    title: `Rate card updated: ${update.origin} → ${update.destination}`,
    detail: null,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "updated" as const, rateCard: rateFromData(rateCardId, customer.id, { ...snapshot.data(), ...update }) };
}

export async function archiveCrmRateCard(customerId: string, rateCardId: string, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };
  const rateRef = customer.ref.collection("rate_cards").doc(rateCardId);
  const snapshot = await rateRef.get();
  if (!snapshot.exists) return { kind: "missing_rate" as const };
  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(rateRef, { active: false, archived_at: now, archived_by_name: actor.name, archived_by_email: actor.email, updated_at: now });
  batch.update(customer.ref, { updated_at: now });
  batch.create(customer.ref.collection("activity").doc(activityId()), {
    type: "rate_card_archived",
    title: `Rate card archived: ${text(snapshot.get("origin"))} → ${text(snapshot.get("destination"))}`,
    detail: null,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "archived" as const };
}
