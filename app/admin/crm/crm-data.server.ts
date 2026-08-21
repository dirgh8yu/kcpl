import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  crmAccountStatuses,
  crmCommunicationPreferences,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStages,
  crmRelationshipTypes,
  crmTaskPriorities,
  kcplBranches,
  type CrmAccountStatus,
  type CrmActivity,
  type CrmAddress,
  type CrmCommunicationPreference,
  type CrmContact,
  type CrmCreateCustomerInput,
  type CrmCurrency,
  type CrmCustomerDetail,
  type CrmCustomerSummary,
  type CrmDashboardStats,
  type CrmDuplicateMatch,
  type CrmEntityKind,
  type CrmLeadSource,
  type CrmLeadStage,
  type CrmNote,
  type CrmRelationshipType,
  type CrmTask,
  type CrmTaskPriority,
  type KcplBranch,
} from "./crm-data";

type Actor = { name: string; email: string };

type AddContactInput = {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  communicationPreference: CrmCommunicationPreference | "";
  isPrimary: boolean;
  notes: string;
};

type AddAddressInput = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
};

type AddTaskInput = {
  title: string;
  detail: string;
  dueAt: string;
  priority: CrmTaskPriority;
  assignedToName: string;
  assignedToEmail: string;
  assignedToPhone: string;
};

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

function childId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
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
    account_manager_phone: nullableString(data.account_manager_phone),
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

function activityData(type: string, title: string, detail: string | null, actor: Actor, createdAt: string) {
  return {
    type,
    title,
    detail,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: createdAt,
  };
}

function activityFromDoc(id: string, data: Record<string, unknown>): CrmActivity {
  return {
    id,
    type: stringValue(data.type, "activity"),
    title: stringValue(data.title, "CRM activity"),
    detail: nullableString(data.detail),
    actor_name: nullableString(data.actor_name),
    actor_email: nullableString(data.actor_email),
    created_at: stringValue(data.created_at),
  };
}

function taskFromDoc(id: string, data: Record<string, unknown>): CrmTask {
  return {
    id,
    title: stringValue(data.title),
    detail: nullableString(data.detail),
    due_at: nullableString(data.due_at),
    priority: enumValue(data.priority, crmTaskPriorities, "normal") as CrmTaskPriority,
    assigned_to_name: nullableString(data.assigned_to_name),
    assigned_to_email: nullableString(data.assigned_to_email),
    assigned_to_phone: nullableString(data.assigned_to_phone),
    completed: booleanValue(data.completed),
    completed_at: nullableString(data.completed_at),
    completed_by_name: nullableString(data.completed_by_name),
    created_by_name: stringValue(data.created_by_name, "KCPL Staff"),
    created_by_email: stringValue(data.created_by_email),
    created_at: stringValue(data.created_at),
    updated_at: stringValue(data.updated_at),
  };
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

export async function createCrmCustomer(input: CrmCreateCustomerInput, actor: Actor) {
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
    account_manager_phone: input.accountManagerPhone.trim() || null,
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
  batch.create(ref.collection("activity").doc(childId("activity")), activityData(
    "customer_created",
    "CRM record created",
    `${actor.name} created this customer record.`,
    actor,
    now,
  ));
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

  const [contactsSnapshot, addressesSnapshot, notesSnapshot, activitySnapshot, tasksSnapshot] = await Promise.all([
    ref.collection("contacts").orderBy("created_at", "asc").limit(200).get(),
    ref.collection("addresses").orderBy("created_at", "asc").limit(100).get(),
    ref.collection("notes").orderBy("created_at", "desc").limit(300).get(),
    ref.collection("activity").orderBy("created_at", "desc").limit(500).get(),
    ref.collection("tasks").orderBy("created_at", "desc").limit(300).get(),
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
    contacts: contactsSnapshot.docs.map((doc): CrmContact => ({
      id: doc.id,
      customer_id: snapshot.id,
      name: stringValue(doc.get("name")),
      job_title: nullableString(doc.get("job_title")),
      email: nullableString(doc.get("email")),
      phone: nullableString(doc.get("phone")),
      communication_preference: doc.get("communication_preference")
        ? enumValue(doc.get("communication_preference"), crmCommunicationPreferences, "other") as CrmCommunicationPreference
        : null,
      is_primary: booleanValue(doc.get("is_primary")),
      notes: nullableString(doc.get("notes")),
      created_at: stringValue(doc.get("created_at")),
      updated_at: stringValue(doc.get("updated_at")),
    })),
    addresses: addressesSnapshot.docs.map((doc): CrmAddress => ({
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
    notes: notesSnapshot.docs.map((doc): CrmNote => ({
      id: doc.id,
      note: stringValue(doc.get("note")),
      author_name: stringValue(doc.get("author_name"), "KCPL Staff"),
      author_email: stringValue(doc.get("author_email")),
      created_at: stringValue(doc.get("created_at")),
    })),
    activity: activitySnapshot.docs.map((doc) => activityFromDoc(doc.id, doc.data() as Record<string, unknown>)),
    tasks: tasksSnapshot.docs.map((doc) => taskFromDoc(doc.id, doc.data() as Record<string, unknown>)),
  };
}

export async function addCrmContact(customerId: string, input: AddContactInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const customerRef = db.collection("customers").doc(customerId.trim().toUpperCase());
  const customer = await customerRef.get();
  if (!customer.exists) return { kind: "missing" as const };

  const now = new Date().toISOString();
  const id = childId("contact");
  const contactRef = customerRef.collection("contacts").doc(id);
  const data = {
    name: input.name.trim(),
    job_title: input.jobTitle.trim() || null,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    communication_preference: input.communicationPreference || null,
    is_primary: input.isPrimary,
    notes: input.notes.trim() || null,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  if (input.isPrimary) {
    const existingPrimary = await customerRef.collection("contacts").where("is_primary", "==", true).limit(20).get();
    existingPrimary.docs.forEach((doc) => batch.update(doc.ref, { is_primary: false, updated_at: now }));
  }
  batch.create(contactRef, data);
  const customerUpdate: Record<string, unknown> = { updated_at: now };
  if (input.isPrimary) {
    customerUpdate.primary_email = data.email;
    customerUpdate.primary_phone = data.phone;
    customerUpdate.normalized_email = normalize(input.email);
    customerUpdate.normalized_phone = normalizePhone(input.phone);
  }
  batch.update(customerRef, customerUpdate);
  batch.create(customerRef.collection("activity").doc(childId("activity")), activityData(
    "contact_added",
    `Contact added: ${data.name}`,
    data.job_title ? `${data.name} added as ${data.job_title}.` : `${data.name} added to the account.`,
    actor,
    now,
  ));
  await batch.commit();

  const contact: CrmContact = { id, customer_id: customerRef.id, ...data };
  return { kind: "created" as const, contact };
}

export async function addCrmAddress(customerId: string, input: AddAddressInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const customerRef = db.collection("customers").doc(customerId.trim().toUpperCase());
  const customer = await customerRef.get();
  if (!customer.exists) return { kind: "missing" as const };

  const now = new Date().toISOString();
  const id = childId("address");
  const addressRef = customerRef.collection("addresses").doc(id);
  const data = {
    label: input.label.trim(),
    line1: input.line1.trim(),
    line2: input.line2.trim() || null,
    city: input.city.trim(),
    state_region: input.stateRegion.trim() || null,
    postal_code: input.postalCode.trim() || null,
    country: input.country.trim(),
    is_primary: input.isPrimary,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  if (input.isPrimary) {
    const existingPrimary = await customerRef.collection("addresses").where("is_primary", "==", true).limit(20).get();
    existingPrimary.docs.forEach((doc) => batch.update(doc.ref, { is_primary: false, updated_at: now }));
  }
  batch.create(addressRef, data);
  batch.update(customerRef, { updated_at: now });
  batch.create(customerRef.collection("activity").doc(childId("activity")), activityData(
    "address_added",
    `Address added: ${data.label}`,
    `${data.city}, ${data.country}`,
    actor,
    now,
  ));
  await batch.commit();

  const address: CrmAddress = { id, ...data };
  return { kind: "created" as const, address };
}

export async function addCrmNote(customerId: string, noteText: string, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const customerRef = db.collection("customers").doc(customerId.trim().toUpperCase());
  const customer = await customerRef.get();
  if (!customer.exists) return { kind: "missing" as const };

  const now = new Date().toISOString();
  const id = childId("note");
  const note: CrmNote = {
    id,
    note: noteText.trim(),
    author_name: actor.name,
    author_email: actor.email,
    created_at: now,
  };
  const batch = db.batch();
  batch.create(customerRef.collection("notes").doc(id), {
    note: note.note,
    author_name: note.author_name,
    author_email: note.author_email,
    created_at: note.created_at,
  });
  batch.update(customerRef, { updated_at: now });
  batch.create(customerRef.collection("activity").doc(childId("activity")), activityData(
    "note_added",
    "Internal note added",
    note.note.length > 180 ? `${note.note.slice(0, 177)}...` : note.note,
    actor,
    now,
  ));
  await batch.commit();
  return { kind: "created" as const, note };
}

export async function addCrmTask(customerId: string, input: AddTaskInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const customerRef = db.collection("customers").doc(customerId.trim().toUpperCase());
  const customer = await customerRef.get();
  if (!customer.exists) return { kind: "missing" as const };

  const now = new Date().toISOString();
  const id = childId("task");
  const task: CrmTask = {
    id,
    title: input.title.trim(),
    detail: input.detail.trim() || null,
    due_at: input.dueAt.trim() || null,
    priority: input.priority,
    assigned_to_name: input.assignedToName.trim() || null,
    assigned_to_email: input.assignedToEmail.trim() || null,
    assigned_to_phone: input.assignedToPhone.trim() || null,
    completed: false,
    completed_at: null,
    completed_by_name: null,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  batch.create(customerRef.collection("tasks").doc(id), task);
  batch.update(customerRef, {
    follow_up_count: numberValue(customer.get("follow_up_count")) + 1,
    updated_at: now,
  });
  batch.create(customerRef.collection("activity").doc(childId("activity")), activityData(
    "task_created",
    `Follow-up created: ${task.title}`,
    task.due_at ? `Due ${task.due_at}.` : null,
    actor,
    now,
  ));
  await batch.commit();
  return { kind: "created" as const, task };
}

export async function setCrmTaskCompleted(customerId: string, taskId: string, completed: boolean, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const customerRef = db.collection("customers").doc(customerId.trim().toUpperCase());
  const taskRef = customerRef.collection("tasks").doc(taskId);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [customerSnapshot, taskSnapshot] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(taskRef),
    ]);
    if (!customerSnapshot.exists) return { kind: "missing" as const };
    if (!taskSnapshot.exists) return { kind: "task_missing" as const };

    const current = taskFromDoc(taskSnapshot.id, taskSnapshot.data() as Record<string, unknown>);
    if (current.completed === completed) return { kind: "updated" as const, task: current };

    const count = numberValue(customerSnapshot.get("follow_up_count"));
    const nextCount = completed ? Math.max(0, count - 1) : count + 1;
    const update = {
      completed,
      completed_at: completed ? now : null,
      completed_by_name: completed ? actor.name : null,
      updated_at: now,
    };
    transaction.update(taskRef, update);
    transaction.update(customerRef, { follow_up_count: nextCount, updated_at: now });
    transaction.create(customerRef.collection("activity").doc(childId("activity")), activityData(
      completed ? "task_completed" : "task_reopened",
      completed ? `Follow-up completed: ${current.title}` : `Follow-up reopened: ${current.title}`,
      null,
      actor,
      now,
    ));

    return { kind: "updated" as const, task: { ...current, ...update } };
  });
}