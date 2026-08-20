import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, kcplBranches, type CrmCurrency } from "../crm/crm-data";
import {
  partnerModes,
  partnerStatuses,
  partnerTypes,
  type PartnerCurrencyAmount,
  type PartnerDashboard,
  type PartnerInput,
  type PartnerMode,
  type PartnerOption,
  type PartnerOwnerBranch,
  type PartnerRecord,
  type PartnerStatus,
  type PartnerType,
} from "./partners-data";

type Actor = { name: string; email: string };
type Exposure = {
  open: Map<CrmCurrency, number>;
  spend: Map<CrmCurrency, number>;
  billCount: number;
  overdueBillCount: number;
  shipments: Set<string>;
  lastActivity: string | null;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown, maxItems = 100) {
  if (!Array.isArray(value)) return [];
  const items = new Set<string>();
  for (const item of value) {
    const cleaned = text(item).trim();
    if (cleaned) items.add(cleaned.slice(0, 160));
    if (items.size >= maxItems) break;
  }
  return [...items];
}

function typedArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return stringArray(value, allowed.length).filter((item): item is T => allowed.includes(item as T));
}

function currencyValue(value: unknown): CrmCurrency {
  const currency = text(value).trim().toUpperCase();
  return crmCurrencies.includes(currency as CrmCurrency) ? currency as CrmCurrency : "NPR";
}

function financialCurrency(value: unknown): CrmCurrency | null {
  const currency = text(value).trim().toUpperCase();
  return crmCurrencies.includes(currency as CrmCurrency) ? currency as CrmCurrency : null;
}

function ownerBranch(value: unknown): PartnerOwnerBranch {
  const branch = text(value).trim();
  if (branch === "Global") return "Global";
  return kcplBranches.includes(branch as (typeof kcplBranches)[number]) ? branch as (typeof kcplBranches)[number] : "Kathmandu";
}

function statusValue(value: unknown): PartnerStatus {
  return partnerStatuses.includes(value as PartnerStatus) ? value as PartnerStatus : "active";
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function partnerReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `KCPL-P-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function amounts(map: Map<CrmCurrency, number>): PartnerCurrencyAmount[] {
  return [...map.entries()]
    .filter(([, amount]) => Math.abs(amount) > 0.00001)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ currency, amount: Number(amount.toFixed(2)) }));
}

function emptyExposure(): Exposure {
  return { open: new Map(), spend: new Map(), billCount: 0, overdueBillCount: 0, shipments: new Set(), lastActivity: null };
}

function addAmount(map: Map<CrmCurrency, number>, currency: CrmCurrency, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

function partnerFromDoc(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  exposure: Exposure = emptyExposure(),
): PartnerRecord {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  const rating = numberValue(data.service_rating);
  return {
    id: doc.id,
    display_name: text(data.display_name, "Unnamed partner"),
    legal_name: nullable(data.legal_name),
    normalized_name: text(data.normalized_name, normalizeName(text(data.display_name))),
    types: typedArray<PartnerType>(data.types, partnerTypes),
    modes: typedArray<PartnerMode>(data.modes, partnerModes),
    status: statusValue(data.status),
    preferred: data.preferred === true,
    country: text(data.country, "Nepal"),
    owner_branch: ownerBranch(data.owner_branch),
    cities_served: stringArray(data.cities_served),
    countries_served: stringArray(data.countries_served),
    ports_served: stringArray(data.ports_served),
    primary_contact_name: nullable(data.primary_contact_name),
    primary_email: nullable(data.primary_email),
    primary_phone: nullable(data.primary_phone),
    whatsapp: nullable(data.whatsapp),
    website: nullable(data.website),
    preferred_currency: currencyValue(data.preferred_currency),
    payment_terms_days: Math.max(0, Math.round(numberValue(data.payment_terms_days))),
    service_rating: rating >= 1 && rating <= 5 ? rating : null,
    registration_number: nullable(data.registration_number),
    tax_id: nullable(data.tax_id),
    contract_reference: nullable(data.contract_reference),
    contract_expiry_date: nullable(data.contract_expiry_date),
    document_url: nullable(data.document_url),
    commercial_terms: nullable(data.commercial_terms),
    internal_notes: nullable(data.internal_notes),
    tags: stringArray(data.tags, 50),
    created_at: text(data.created_at),
    created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email),
    updated_at: text(data.updated_at),
    updated_by_name: text(data.updated_by_name, "KCPL Staff"),
    updated_by_email: text(data.updated_by_email),
    payable_open: amounts(exposure.open),
    payable_spend: amounts(exposure.spend),
    bill_count: exposure.billCount,
    overdue_bill_count: exposure.overdueBillCount,
    shipment_count: exposure.shipments.size,
    last_activity_at: exposure.lastActivity,
  };
}

function partnerDocument(input: PartnerInput, actor: Actor, previous?: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    display_name: input.displayName.trim(),
    legal_name: input.legalName.trim() || null,
    normalized_name: normalizeName(input.displayName),
    types: input.types,
    modes: input.modes,
    status: input.status,
    preferred: input.preferred,
    country: input.country.trim() || "Nepal",
    owner_branch: input.ownerBranch,
    cities_served: input.citiesServed,
    countries_served: input.countriesServed,
    ports_served: input.portsServed,
    primary_contact_name: input.primaryContactName.trim() || null,
    primary_email: input.primaryEmail.trim().toLowerCase() || null,
    primary_phone: input.primaryPhone.trim() || null,
    whatsapp: input.whatsapp.trim() || null,
    website: input.website.trim() || null,
    preferred_currency: input.preferredCurrency,
    payment_terms_days: Math.max(0, Math.round(input.paymentTermsDays)),
    service_rating: input.serviceRating,
    registration_number: input.registrationNumber.trim() || null,
    tax_id: input.taxId.trim() || null,
    contract_reference: input.contractReference.trim() || null,
    contract_expiry_date: input.contractExpiryDate.trim() || null,
    document_url: input.documentUrl.trim() || null,
    commercial_terms: input.commercialTerms.trim() || null,
    internal_notes: input.internalNotes.trim() || null,
    tags: input.tags,
    created_at: previous ? text(previous.created_at, now) : now,
    created_by_name: previous ? text(previous.created_by_name, actor.name) : actor.name,
    created_by_email: previous ? text(previous.created_by_email, actor.email) : actor.email,
    updated_at: now,
    updated_by_name: actor.name,
    updated_by_email: actor.email,
  };
}

async function duplicatePartner(normalizedName: string, excludeId?: string) {
  const snapshot = await firebaseAdminDb().collection("partners").where("normalized_name", "==", normalizedName).limit(3).get();
  return snapshot.docs.find((doc) => doc.id !== excludeId) ?? null;
}

export async function listPartnerDashboard(): Promise<PartnerDashboard | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const [partnersSnapshot, payablesSnapshot] = await Promise.all([
    db.collection("partners").orderBy("display_name", "asc").limit(2500).get(),
    db.collection("payables").limit(8000).get(),
  ]);

  const exposures = new Map<string, Exposure>();
  const partnerByName = new Map<string, string>();
  for (const doc of partnersSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    exposures.set(doc.id, emptyExposure());
    partnerByName.set(text(data.normalized_name, normalizeName(text(data.display_name))), doc.id);
  }

  let unlinkedSupplierBills = 0;
  const today = operationalDate();
  for (const bill of payablesSnapshot.docs) {
    const data = bill.data() as Record<string, unknown>;
    const status = text(data.status, "draft");
    if (status === "void" || status === "draft") continue;
    const supplierId = nullable(data.supplier_id);
    const supplierName = normalizeName(text(data.supplier_name));
    const partnerId = supplierId && exposures.has(supplierId) ? supplierId : partnerByName.get(supplierName);
    if (!partnerId) {
      unlinkedSupplierBills += 1;
      continue;
    }

    const exposure = exposures.get(partnerId)!;
    const currency = financialCurrency(data.currency);
    const total = numberValue(data.total);
    const balance = Math.max(0, numberValue(data.balance_due));
    exposure.billCount += 1;
    const shipment = nullable(data.shipment_reference);
    if (shipment) exposure.shipments.add(shipment);
    const activity = text(data.updated_at, text(data.created_at));
    if (activity && (!exposure.lastActivity || activity > exposure.lastActivity)) exposure.lastActivity = activity;
    if (currency) {
      addAmount(exposure.spend, currency, total);
      if (balance > 0.00001 && status !== "paid") addAmount(exposure.open, currency, balance);
    }
    const dueDate = text(data.due_date);
    if (balance > 0.00001 && status !== "paid" && (status === "overdue" || (dueDate && dueDate < today))) exposure.overdueBillCount += 1;
  }

  const partners = partnersSnapshot.docs.map((doc) => partnerFromDoc(doc, exposures.get(doc.id)));
  const openPayables = new Map<CrmCurrency, number>();
  for (const partner of partners) for (const item of partner.payable_open) addAmount(openPayables, item.currency, item.amount);

  return {
    generated_at: new Date().toISOString(),
    partners,
    active_count: partners.filter((partner) => partner.status === "active").length,
    preferred_count: partners.filter((partner) => partner.preferred && partner.status === "active").length,
    country_count: new Set(partners.filter((partner) => partner.status !== "inactive").map((partner) => partner.country.trim()).filter(Boolean)).size,
    unlinked_supplier_bills: unlinkedSupplierBills,
    open_payables: amounts(openPayables),
  };
}

export async function listPartnerOptions(): Promise<PartnerOption[] | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("partners").where("status", "==", "active").limit(2500).get();
  return snapshot.docs
    .map((doc) => partnerFromDoc(doc))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((partner) => ({ id: partner.id, name: partner.display_name, currency: partner.preferred_currency, payment_terms_days: partner.payment_terms_days }));
}

export async function createPartner(input: PartnerInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const normalizedName = normalizeName(input.displayName);
  const duplicate = await duplicatePartner(normalizedName);
  if (duplicate) return { kind: "duplicate" as const, partner: partnerFromDoc(duplicate) };
  const id = partnerReference();
  const document = partnerDocument(input, actor);
  const ref = firebaseAdminDb().collection("partners").doc(id);
  await ref.create(document);
  const saved = await ref.get();
  return { kind: "created" as const, partner: partnerFromDoc(saved) };
}

export async function updatePartner(id: string, input: PartnerInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("partners").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const normalizedName = normalizeName(input.displayName);
  const duplicate = await duplicatePartner(normalizedName, id);
  if (duplicate) return { kind: "duplicate" as const, partner: partnerFromDoc(duplicate) };
  const previous = snapshot.data() as Record<string, unknown>;
  const document = partnerDocument(input, actor, previous);
  await ref.set(document, { merge: true });
  const saved = await ref.get();
  return { kind: "updated" as const, partner: partnerFromDoc(saved) };
}
