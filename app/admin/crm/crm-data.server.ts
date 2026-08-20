import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  crmAccountStatuses,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStages,
  crmRelationshipTypes,
  kcplBranches,
  type CrmAccountStatus,
  type CrmCreateCustomerInput,
  type CrmCurrency,
  type CrmCustomerDetail,
  type CrmCustomerSummary,
  type CrmDashboardStats,
  type CrmDuplicateMatch,
  type CrmEntityKind,
  type CrmLeadSource,
  type CrmLeadStage,
  type CrmRelationshipType,
  type KcplBranch,
} from "./crm-data";

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  const text = stringValue(value).trim();
  return text || null;
}

function booleanValue(value: unknown) {
  return value === true;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function enumValue<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] {
  return values.includes(value as T[number]) ? value as T[number] : fallback;
}

function relationshipTypes(value: unknown): CrmRelationshipType[] {
  const list = stringArray(value).filter((item): item is CrmRelationshipType => crmRelationshipTypes.includes(item as CrmRelationshipType));
  return list.length ? list : ["customer"];
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

function customerReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `KCPL-C-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function summaryFromData(id: string, data: Record<string, unknown>): CrmCustomerSummary {
  const preferredCurrency = enumValue(data.preferred_currency, crmCurrencies, "NPR") as CrmCurrency;
  return {
    id,
    entity_kind: enumValue(data.entity_kind, crmEntityKinds, "company") as CrmEntityKind,
    display_name: stringValue(data.display_name, id),
    legal_name: nullableString(data.legal_name),
    relationship_types: relationshipTypes(data.relationship_types),
    account_status: enumValue(data.account_status, crmAccountStatuses, "prospect") as CrmAccountStatus,
    lead_stage: enumValue(data.lead_stage, crmLeadStages, "new_lead") as CrmLeadStage,
    lead_source: data.lead_source ? enumValue(data.lead_source, crmLeadSources, "other") as CrmLeadSource : null,
    primary_email: nullableString(data.primary_email),
    primary_phone: nullableString(data.primary_phone),
    country: stringValue(data.country, "Nepal"),
    primary_branch: enumValue(data.primary_branch, kcplBranches, "Kathmandu") as KcplBranch,
    account_manager_name: nullableString(data.account_manager_name),
    account_manager_email: nullableString(data.account_manager_email),
    tags: stringArray(data.tags),
    quote_count: numberValue(data.quote_count),
    active_shipment_count: numberValue(data.active_shipment_count),
    completed_shipment_count: numberValue(data.completed_shipment_count),
    follow_up_count: numberValue(data.follow_up_count),
    revenue_total: numberValue(data.revenue_total),
    cost_total: numberValue(data.cost_total),
    profit_total: numberValue(data.profit_total),
    preferred_currency: preferredCurrency,
    archived: booleanValue(data.archived),
    created_at: stringValue(data.created_at),
    updated_at: stringValue(data.updated_at),
  };
}

function parseOptionalMoney(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalPercent(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalDays(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function listCrmCustomers(): Promise<CrmCustomerSummary[] | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("customers")
    .orderBy("updated_at", "desc")
    .limit(500)
    .get();
  return snapshot.docs
    .map((doc) => summaryFromData(doc.id, doc.data() as Record<string, unknown>))
    .filter((customer) => !customer.archived);
}

export function crmDashboardStats(customers: CrmCustomerSummary[]): CrmDashboardStats {
  return {
    total: customers.length,
    prospects: customers.filter((customer) => customer.account_status === "prospect").length,
    active: customers.filter((customer) => customer.account_status === "active").length,
    dormant: customers.filter((customer) => customer.account_status === "dormant").length,
    onHold: customers.filter((customer) => customer.account_status === "on_hold").length,
    blacklisted: customers.filter((customer) => customer.account_status === "blacklisted").length,
    followUpsDue: customers.reduce((total, customer) => total + customer.follow_up_count, 0),
  };
}

export async function findCrmDuplicates(input: Pick<CrmCreateCustomerInput, "displayName" | "primaryEmail" | "primaryPhone" | "taxId">) {
  if (!firebaseRuntimeConfigured()) return [] as CrmDuplicateMatch[];
  const db = firebaseAdminDb();
  const checks: Array<{ field: string; value: string; reason: CrmDuplicateMatch["reason"] }> = [];
  const normalizedName = normalize(input.displayName);
  const normalizedEmail = normalize(input.primaryEmail);
  const normalizedPhone = normalizePhone(input.primaryPhone);
  const normalizedTax = normalize(input.taxId);

  if (normalizedName) checks.push({ field: "normalized_name", value: normalizedName, reason: "name" });
  if (normalizedEmail) checks.push({ field: "normalized_email", value: normalizedEmail, reason: "email" });
  if (normalizedPhone) checks.push({ field: "normalized_phone", value: normalizedPhone, reason: "phone" });
  if (normalizedTax) checks.push({ field: "normalized_tax_id", value: normalizedTax, reason: "tax_id" });

  const matches = new Map<string, CrmDuplicateMatch>();
  for (const check of checks) {
    const snapshot = await db.collection("customers").where(check.field, "==", check.value).limit(8).get();
    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (booleanValue(data.archived)) continue;
      if (!matches.has(doc.id)) {
        matches.set(doc.id, {
          id: doc.id,
          display_name: stringValue(data.display_name, doc.id),
          reason: check.reason,
        });
      }
    }
  }
  return [...matches.values()];
}

export async function createCrmCustomer(input: CrmCreateCustomerInput, actor: { name: string; email: string }) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = customerReference();
  const now = new Date().toISOString();
  const ref = db.collection("customers").doc(id);

  const document = {
    schema_version: 1,
    entity_kind: input.entityKind,
    display_name: input.displayName.trim(),
    legal_name: input.legalName.trim() || null,
    trading_name: input.tradingName.trim() || null,
    relationship_types: input.relationshipTypes,
    account_status: input.accountStatus,
    lead_stage: input.leadStage,
    lead_source: input.leadSource || null,
    primary_email: input.primaryEmail.trim() || null,
    primary_phone: input.primaryPhone.trim() || null,
    website: input.website.trim() || null,
    industry: input.industry.trim() || null,
    tax_id: input.taxId.trim() || null,
    country: input.country.trim() || "Nepal",
    primary_branch: input.primaryBranch,
    account_manager_name: input.accountManagerName.trim() || null,
    account_manager_email: input.accountManagerEmail.trim() || null,
    billing_email: input.billingEmail.trim() || null,
    preferred_currency: input.preferredCurrency,
    payment_terms_days: parseOptionalDays(input.paymentTermsDays),
    credit_limit: parseOptionalMoney(input.creditLimit),
    outstanding_balance: parseOptionalMoney(input.outstandingBalance),
    pricing_notes: input.pricingNotes.trim() || null,
    markup_percent: parseOptionalPercent(input.markupPercent),
    preferred_carriers: input.preferredCarriers,
    transport_preferences: input.transportPreferences,
    tags: input.tags,
    internal_summary: input.internalSummary.trim() || null,
    normalized_name: normalize(input.displayName),
    normalized_email: normalize(input.primaryEmail),
    normalized_phone: normalizePhone(input.primaryPhone),
    normalized_tax_id: normalize(input.taxId),
    quote_count: 0,
    active_shipment_count: 0,
    completed_shipment_count: 0,
    follow_up_count: 0,
    revenue_total: 0,
    cost_total: 0,
    profit_total: 0,
    archived: false,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  batch.create(ref, document);
  batch.create(ref.collection("activity").doc(`${Date.now()}-created`), {
    type: "customer_created",
    title: "CRM record created",
    detail: `${actor.name} created this customer record.`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();

  return { kind: "created" as const, customer: summaryFromData(id, document) };
}

export async function getCrmCustomer(id: string): Promise<CrmCustomerDetail | null | undefined> {
  if (!firebaseRuntimeConfigured()) return undefined;
  const ref = firebaseAdminDb().collection("customers").doc(id.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const summary = summaryFromData(snapshot.id, data);

  const [contactsSnapshot, addressesSnapshot] = await Promise.all([
    ref.collection("contacts").orderBy("created_at", "asc").limit(200).get(),
    ref.collection("addresses").orderBy("created_at", "asc").limit(100).get(),
  ]);

  return {
    ...summary,
    trading_name: nullableString(data.trading_name),
    website: nullableString(data.website),
    industry: nullableString(data.industry),
    tax_id: nullableString(data.tax_id),
    billing_email: nullableString(data.billing_email),
    transport_preferences: stringArray(data.transport_preferences),
    internal_summary: nullableString(data.internal_summary),
    commercial: {
      preferred_currency: summary.preferred_currency,
      payment_terms_days: nullableNumber(data.payment_terms_days),
      credit_limit: nullableNumber(data.credit_limit),
      outstanding_balance: nullableNumber(data.outstanding_balance),
      pricing_notes: nullableString(data.pricing_notes),
      markup_percent: nullableNumber(data.markup_percent),
      preferred_carriers: stringArray(data.preferred_carriers),
    },
    contacts: contactsSnapshot.docs.map((doc) => ({
      id: doc.id,
      customer_id: snapshot.id,
      name: stringValue(doc.get("name")),
      job_title: nullableString(doc.get("job_title")),
      email: nullableString(doc.get("email")),
      phone: nullableString(doc.get("phone")),
      communication_preference: nullableString(doc.get("communication_preference")) as CrmCustomerDetail["contacts"][number]["communication_preference"],
      is_primary: booleanValue(doc.get("is_primary")),
      notes: nullableString(doc.get("notes")),
      created_at: stringValue(doc.get("created_at")),
      updated_at: stringValue(doc.get("updated_at")),
    })),
    addresses: addressesSnapshot.docs.map((doc) => ({
      id: doc.id,
      label: stringValue(doc.get("label"), "Address"),
      line1: stringValue(doc.get("line1")),
      line2: nullableString(doc.get("line2")),
      city: stringValue(doc.get("city")),
      state_region: nullableString(doc.get("state_region")),
      postal_code: nullableString(doc.get("postal_code")),
      country: stringValue(doc.get("country")),
      is_primary: booleanValue(doc.get("is_primary")),
      created_at: stringValue(doc.get("created_at")),
      updated_at: stringValue(doc.get("updated_at")),
    })),
  };
}
