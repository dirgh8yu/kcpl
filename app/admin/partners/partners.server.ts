import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue } from "../branch-access-policy";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import type { KcplStaffContext } from "../staff-directory.server";
import {
  partnerModes,
  partnerStatuses,
  partnerTypes,
  type PartnerCurrencyAmount,
  type PartnerDashboard,
  type PartnerInput,
  type PartnerMode,
  type PartnerOption,
  type PartnerRecord,
  type PartnerStatus,
  type PartnerType,
} from "./partners-data";
import {
  canAccessPartnerOwner,
  canAssignPartnerOwner,
  canEditPartnerNetwork,
  canViewPartnerFinance,
  isPartnerReference,
  normalizePartnerIdentifier,
  partnerOwnerBranchValue,
} from "./partner-policy";

type Actor = { name: string; email: string };
type Exposure = {
  open: Map<CrmCurrency, number>;
  spend: Map<CrmCurrency, number>;
  billCount: number;
  overdueBillCount: number;
  shipments: Set<string>;
  lastActivity: string | null;
};
type DuplicateReason = "name" | "tax_id" | "registration_number";

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

function childId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
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
  context?: KcplStaffContext,
): PartnerRecord {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  const rating = numberValue(data.service_rating);
  const commercialVisible = context ? context.permissions.canViewCommercial : true;
  const financeVisible = context ? canViewPartnerFinance(context.permissions) : true;
  const updatedAt = text(data.updated_at);
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
    owner_branch: partnerOwnerBranchValue(data.owner_branch),
    cities_served: stringArray(data.cities_served),
    countries_served: stringArray(data.countries_served),
    ports_served: stringArray(data.ports_served),
    primary_contact_name: nullable(data.primary_contact_name),
    primary_email: nullable(data.primary_email),
    primary_phone: nullable(data.primary_phone),
    whatsapp: nullable(data.whatsapp),
    website: nullable(data.website),
    preferred_currency: commercialVisible ? currencyValue(data.preferred_currency) : "NPR",
    payment_terms_days: commercialVisible ? Math.max(0, Math.round(numberValue(data.payment_terms_days))) : 0,
    service_rating: rating >= 1 && rating <= 5 ? rating : null,
    registration_number: nullable(data.registration_number),
    tax_id: nullable(data.tax_id),
    contract_reference: nullable(data.contract_reference),
    contract_expiry_date: nullable(data.contract_expiry_date),
    document_url: nullable(data.document_url),
    commercial_terms: commercialVisible ? nullable(data.commercial_terms) : null,
    internal_notes: nullable(data.internal_notes),
    tags: stringArray(data.tags, 50),
    created_at: text(data.created_at),
    created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email),
    updated_at: updatedAt,
    updated_by_name: text(data.updated_by_name, "KCPL Staff"),
    updated_by_email: text(data.updated_by_email),
    payable_open: financeVisible ? amounts(exposure.open) : [],
    payable_spend: financeVisible ? amounts(exposure.spend) : [],
    bill_count: financeVisible ? exposure.billCount : 0,
    overdue_bill_count: financeVisible ? exposure.overdueBillCount : 0,
    shipment_count: financeVisible ? exposure.shipments.size : 0,
    last_activity_at: exposure.lastActivity ?? updatedAt || null,
  };
}

function partnerDocument(input: PartnerInput, actor: Actor, previous?: Record<string, unknown>) {
  const now = new Date().toISOString();
  const normalizedTaxId = normalizePartnerIdentifier(input.taxId);
  const normalizedRegistration = normalizePartnerIdentifier(input.registrationNumber);
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
    normalized_registration_number: normalizedRegistration || null,
    tax_id: input.taxId.trim() || null,
    normalized_tax_id: normalizedTaxId || null,
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

async function duplicatePartner(input: PartnerInput, excludeId?: string) {
  const db = firebaseAdminDb();
  const normalizedName = normalizeName(input.displayName);
  const normalizedTaxId = normalizePartnerIdentifier(input.taxId);
  const normalizedRegistration = normalizePartnerIdentifier(input.registrationNumber);
  const checks: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [
    db.collection("partners").where("normalized_name", "==", normalizedName).limit(3).get(),
  ];
  const reasons: DuplicateReason[] = ["name"];
  if (normalizedTaxId) {
    checks.push(db.collection("partners").where("normalized_tax_id", "==", normalizedTaxId).limit(3).get());
    reasons.push("tax_id");
  }
  if (normalizedRegistration) {
    checks.push(db.collection("partners").where("normalized_registration_number", "==", normalizedRegistration).limit(3).get());
    reasons.push("registration_number");
  }
  const snapshots = await Promise.all(checks);
  for (let index = 0; index < snapshots.length; index += 1) {
    const duplicate = snapshots[index].docs.find((doc) => doc.id !== excludeId);
    if (duplicate) return { doc: duplicate, reason: reasons[index] };
  }
  return null;
}

async function writePartnerActivity(partnerId: string, title: string, detail: string, actor: Actor) {
  await firebaseAdminDb().collection("partners").doc(partnerId).collection("activity").doc(childId("activity")).create({
    type: "partner_activity",
    title,
    detail,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: new Date().toISOString(),
  });
}

export async function listPartnerDashboard(context: KcplStaffContext): Promise<PartnerDashboard | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const financeVisible = canViewPartnerFinance(context.permissions);
  const [partnersSnapshot, payablesSnapshot] = await Promise.all([
    db.collection("partners").orderBy("display_name", "asc").limit(2500).get(),
    financeVisible ? db.collection("payables").limit(8000).get() : Promise.resolve(null),
  ]);

  const partnerDocs = partnersSnapshot.docs.filter((doc) => canAccessPartnerOwner(context, doc.get("owner_branch")));
  const exposures = new Map<string, Exposure>();
  const partnerByName = new Map<string, string>();
  for (const doc of partnerDocs) {
    const data = doc.data() as Record<string, unknown>;
    exposures.set(doc.id, emptyExposure());
    partnerByName.set(text(data.normalized_name, normalizeName(text(data.display_name))), doc.id);
  }

  let unlinkedSupplierBills = 0;
  let legacyNameLinkedBillCount = 0;
  const today = operationalDate();
  for (const bill of payablesSnapshot?.docs ?? []) {
    const data = bill.data() as Record<string, unknown>;
    if (!canAccessBranchValue(context, data.branch)) continue;
    const status = text(data.status, "draft");
    if (status === "void" || status === "draft") continue;
    const supplierId = nullable(data.supplier_id);
    const supplierName = normalizeName(text(data.supplier_name));
    let partnerId: string | undefined;
    if (supplierId && isPartnerReference(supplierId)) partnerId = exposures.has(supplierId) ? supplierId : undefined;
    else if (supplierName) {
      partnerId = partnerByName.get(supplierName);
      if (partnerId) legacyNameLinkedBillCount += 1;
    }
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

  const partners = partnerDocs.map((doc) => partnerFromDoc(doc, exposures.get(doc.id), context));
  const openPayables = new Map<CrmCurrency, number>();
  if (financeVisible) {
    for (const partner of partners) for (const item of partner.payable_open) addAmount(openPayables, item.currency, item.amount);
  }

  return {
    generated_at: new Date().toISOString(),
    partners,
    active_count: partners.filter((partner) => partner.status === "active").length,
    preferred_count: partners.filter((partner) => partner.preferred && partner.status === "active").length,
    country_count: new Set(partners.filter((partner) => partner.status !== "inactive").map((partner) => partner.country.trim()).filter(Boolean)).size,
    unlinked_supplier_bills: financeVisible ? unlinkedSupplierBills : 0,
    legacy_name_linked_bill_count: financeVisible ? legacyNameLinkedBillCount : 0,
    open_payables: financeVisible ? amounts(openPayables) : [],
  };
}

export async function listPartnerOptions(context: KcplStaffContext): Promise<PartnerOption[] | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("partners").where("status", "==", "active").limit(2500).get();
  return snapshot.docs
    .filter((doc) => canAccessPartnerOwner(context, doc.get("owner_branch")))
    .map((doc) => partnerFromDoc(doc))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((partner) => ({
      id: partner.id,
      name: partner.display_name,
      currency: partner.preferred_currency,
      payment_terms_days: partner.payment_terms_days,
      owner_branch: partner.owner_branch,
      types: partner.types,
    }));
}

export async function getPartnerRecord(id: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("partners").doc(id.trim().toUpperCase()).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  if (!canAccessPartnerOwner(context, snapshot.get("owner_branch"))) return { kind: "forbidden" as const };
  return { kind: "ready" as const, partner: partnerFromDoc(snapshot, emptyExposure(), context), snapshot };
}

export async function createPartner(input: PartnerInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!canEditPartnerNetwork(context.permissions) || !canAssignPartnerOwner(context, context.permissions, input.ownerBranch)) return { kind: "forbidden" as const };
  const duplicate = await duplicatePartner(input);
  if (duplicate) return { kind: "duplicate" as const, reason: duplicate.reason, partner: partnerFromDoc(duplicate.doc, emptyExposure(), context) };
  const id = partnerReference();
  const document = partnerDocument(input, actor);
  const ref = firebaseAdminDb().collection("partners").doc(id);
  await ref.create(document);
  await writePartnerActivity(id, "Partner record created", `${input.displayName} added to the KCPL operating network.`, actor);
  const saved = await ref.get();
  return { kind: "created" as const, partner: partnerFromDoc(saved, emptyExposure(), context) };
}

export async function updatePartner(id: string, input: PartnerInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!canEditPartnerNetwork(context.permissions)) return { kind: "forbidden" as const };
  const ref = firebaseAdminDb().collection("partners").doc(id.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  if (!canAccessPartnerOwner(context, snapshot.get("owner_branch"))) return { kind: "forbidden" as const };
  if (!canAssignPartnerOwner(context, context.permissions, input.ownerBranch)) return { kind: "forbidden_owner" as const };
  const duplicate = await duplicatePartner(input, snapshot.id);
  if (duplicate) return { kind: "duplicate" as const, reason: duplicate.reason, partner: partnerFromDoc(duplicate.doc, emptyExposure(), context) };
  const previous = snapshot.data() as Record<string, unknown>;
  const document = partnerDocument(input, actor, previous);
  await ref.set(document, { merge: true });
  await writePartnerActivity(snapshot.id, "Partner record updated", `${input.displayName} network details were updated.`, actor);
  const saved = await ref.get();
  return { kind: "updated" as const, partner: partnerFromDoc(saved, emptyExposure(), context) };
}
