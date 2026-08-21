import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb } from "../firebase-admin.server";
import {
  quoteCurrencies,
  quoteStatuses,
  type QuoteCommercialInput,
  type QuoteCommunication,
  type QuoteCrmMatch,
  type QuoteCurrency,
  type QuoteDetail,
  type QuoteNote,
  type QuoteStatus,
  type QuoteSummary,
} from "./admin-data";
import { canAccessQuoteLinkedRecords, strictBranchValue } from "./branch-access-policy";
import { ensureShipmentForWonQuote, getShipmentForQuote } from "../shipment-data.server";
import { listStaffProfiles, resolveStaffIdentity, resolveStaffIdentityFromProfiles, type KcplStaffContext } from "./staff-directory.server";
import type { KcplStaffProfile } from "./staff-directory";

function configured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

function quoteStatus(value: unknown): QuoteStatus {
  return quoteStatuses.includes(value as QuoteStatus) ? value as QuoteStatus : "new";
}

function quoteCurrency(value: unknown): QuoteCurrency {
  return quoteCurrencies.includes(value as QuoteCurrency) ? value as QuoteCurrency : "USD";
}

function crmMatches(value: unknown): QuoteCrmMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const data = item as Record<string, unknown>;
    const id = stringValue(data.id).trim().toUpperCase();
    const displayName = stringValue(data.display_name).trim();
    const reason = stringValue(data.reason).trim();
    return id && displayName ? [{ id, display_name: displayName, reason }] : [];
  });
}

function summaryFromData(reference: string, data: Record<string, unknown>, profiles: KcplStaffProfile[] = []): QuoteSummary {
  const legacyAssignee = nullableString(data.assigned_to);
  const storedName = nullableString(data.assigned_to_name) ?? legacyAssignee;
  const identity = resolveStaffIdentityFromProfiles({
    uid: nullableString(data.assigned_to_uid),
    name: storedName,
    email: nullableString(data.assigned_to_email),
    phone: nullableString(data.assigned_to_phone),
  }, profiles);
  const assignedName = identity.name ?? storedName;
  return {
    reference,
    created_at: stringValue(data.created_at),
    status: quoteStatus(data.status),
    origin: stringValue(data.origin),
    destination: stringValue(data.destination),
    mode: stringValue(data.mode),
    cargo_type: nullableString(data.cargo_type),
    contact_name: stringValue(data.contact_name),
    contact_email: stringValue(data.contact_email),
    company_name: nullableString(data.company_name),
    phone: nullableString(data.phone),
    customer_id: nullableString(data.customer_id),
    assigned_to: assignedName,
    assigned_to_uid: identity.uid,
    assigned_to_name: assignedName,
    assigned_to_email: identity.email,
    assigned_to_phone: identity.phone,
    note_count: Number(data.note_count ?? 0) || 0,
    email_count: Number(data.email_count ?? 0) || 0,
    last_customer_email_at: nullableString(data.last_customer_email_at),
  };
}

function detailFromData(reference: string, data: Record<string, unknown>, profiles: KcplStaffProfile[] = []): Omit<QuoteDetail, "notes" | "communications" | "shipment"> {
  return {
    ...summaryFromData(reference, data, profiles),
    weight: nullableString(data.weight),
    weight_unit: nullableString(data.weight_unit),
    length: nullableString(data.length),
    width: nullableString(data.width),
    height: nullableString(data.height),
    dimension_unit: nullableString(data.dimension_unit),
    timing: nullableString(data.timing),
    requirements: nullableString(data.requirements),
    quote_currency: quoteCurrency(data.quote_currency),
    quoted_amount: nullableString(data.quoted_amount),
    internal_cost: nullableString(data.internal_cost),
    valid_until: nullableString(data.valid_until),
    customer_quote_note: nullableString(data.customer_quote_note),
    crm_match_state: nullableString(data.crm_match_state),
    crm_matches: crmMatches(data.crm_matches),
  };
}

function communicationFromData(id: string, data: Record<string, unknown>): QuoteCommunication {
  return {
    id,
    quote_reference: stringValue(data.quote_reference),
    type: stringValue(data.type, "quote_email"),
    channel: stringValue(data.channel, "email"),
    direction: stringValue(data.direction, "outbound"),
    to: stringValue(data.to),
    from: stringValue(data.from),
    subject: stringValue(data.subject),
    provider: stringValue(data.provider),
    provider_message_id: nullableString(data.provider_message_id),
    status: stringValue(data.status),
    sent_at: stringValue(data.sent_at, stringValue(data.created_at)),
    actor_name: stringValue(data.actor_name),
    actor_email: stringValue(data.actor_email),
    created_at: stringValue(data.created_at, stringValue(data.sent_at)),
  };
}

function numericId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

async function loadDocumentsByIds(collectionName: string, ids: Iterable<string>) {
  const db = firebaseAdminDb();
  const unique = [...new Set([...ids].map((id) => id.trim()).filter(Boolean))];
  const output = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < unique.length; index += 250) {
    const batch = unique.slice(index, index + 250);
    const snapshots = await db.getAll(...batch.map((id) => db.collection(collectionName).doc(id)));
    for (const snapshot of snapshots) {
      if (snapshot.exists) output.set(snapshot.id, snapshot.data() as Record<string, unknown>);
    }
  }
  return output;
}

export async function listQuoteSummaries(context: KcplStaffContext): Promise<QuoteSummary[] | null> {
  if (!configured()) return null;
  const [snapshot, profiles] = await Promise.all([
    firebaseAdminDb().collection("quotes").orderBy("created_at", "desc").limit(1000).get(),
    listStaffProfiles(),
  ]);
  const visibleDocs = snapshot.docs.filter((doc) => doc.get("migration_hidden") !== true);

  if (context.can_access_all_branches) {
    return visibleDocs.map((doc) => summaryFromData(doc.id, doc.data() as Record<string, unknown>, profiles ?? []));
  }

  const rows = visibleDocs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
  const shipmentReferences = rows.flatMap(({ data }) => {
    const reference = nullableString(data.shipment_reference);
    return reference ? [reference] : [];
  });
  const shipments = await loadDocumentsByIds("shipments", shipmentReferences);
  const customerIds = new Set<string>();
  for (const { data } of rows) {
    const customerId = nullableString(data.customer_id);
    if (customerId) customerIds.add(customerId);
  }
  for (const shipment of shipments.values()) {
    const customerId = nullableString(shipment.customer_id);
    if (customerId) customerIds.add(customerId);
  }
  const customers = await loadDocumentsByIds("customers", customerIds);

  return rows.flatMap(({ id, data }) => {
    const shipmentReference = nullableString(data.shipment_reference);
    const shipment = shipmentReference ? shipments.get(shipmentReference) : undefined;
    const quoteCustomerId = nullableString(data.customer_id);
    const effectiveCustomerId = shipment ? nullableString(shipment.customer_id) ?? quoteCustomerId : quoteCustomerId;
    const customer = effectiveCustomerId ? customers.get(effectiveCustomerId) : undefined;
    const allowed = canAccessQuoteLinkedRecords(context, {
      shipment_reference: shipmentReference,
      customer_id: quoteCustomerId,
      shipment_exists: Boolean(shipment),
      shipment_primary_branch: strictBranchValue(shipment?.primary_branch) ?? customer?.primary_branch,
      shipment_handling_branches: shipment?.handling_branches,
      customer_exists: Boolean(customer),
      customer_branch: customer?.primary_branch,
    });
    return allowed ? [summaryFromData(id, data, profiles ?? [])] : [];
  });
}

export async function getQuoteDetail(reference: string): Promise<QuoteDetail | null | undefined> {
  if (!configured()) return undefined;
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const [quoteSnapshot, profiles] = await Promise.all([
    db.collection("quotes").doc(normalized).get(),
    listStaffProfiles(),
  ]);
  if (!quoteSnapshot.exists || quoteSnapshot.get("migration_hidden") === true) return null;

  const quote = detailFromData(normalized, quoteSnapshot.data() as Record<string, unknown>, profiles ?? []);
  const [notesSnapshot, communicationsSnapshot] = await Promise.all([
    quoteSnapshot.ref.collection("notes").orderBy("created_at", "desc").limit(500).get(),
    quoteSnapshot.ref.collection("communications").orderBy("sent_at", "desc").limit(500).get(),
  ]);
  const notes = notesSnapshot.docs.map((doc) => doc.data() as QuoteNote);
  const communications = communicationsSnapshot.docs.map((doc) => communicationFromData(doc.id, doc.data() as Record<string, unknown>));

  let shipment: QuoteDetail["shipment"] = null;
  try {
    shipment = (await getShipmentForQuote(normalized)) ?? null;
    if (!shipment && quote.status === "won" && quote.customer_id) {
      const created = await ensureShipmentForWonQuote(normalized);
      if (created.kind === "created" || created.kind === "ready") shipment = created.shipment ?? null;
    }
  } catch (error) {
    console.error("Failed to load or initialize Firebase shipment for quote", normalized, error);
  }

  return { ...quote, shipment, notes, communications };
}

export async function updateQuoteAdmin(
  reference: string,
  status: QuoteStatus,
  assignee: { uid?: string; name: string; email: string; phone: string },
  allowCommercialTransition: boolean,
) {
  if (!configured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("quotes").doc(reference.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };

  const currentStatus = quoteStatus(snapshot.get("status"));
  const statusChanged = currentStatus !== status;
  const commercialStates: QuoteStatus[] = ["quoted", "won", "lost"];
  const commercialTransition = statusChanged && (commercialStates.includes(currentStatus) || commercialStates.includes(status));

  if (commercialTransition && !allowCommercialTransition) {
    return { kind: "commercial-required" as const, currentStatus };
  }
  if (currentStatus === "won" && status !== "won") {
    return { kind: "won-locked" as const, currentStatus };
  }
  if (status === "won" && !nullableString(snapshot.get("customer_id"))) {
    return { kind: "customer-required" as const, currentStatus };
  }

  const resolved = await resolveStaffIdentity({ uid: assignee.uid, name: assignee.name, email: assignee.email, phone: assignee.phone });
  const assignedUid = resolved.uid;
  const assignedName = resolved.name ?? assignee.name.trim();
  const assignedEmail = resolved.email ?? assignee.email.trim().toLowerCase();
  const assignedPhone = resolved.phone ?? assignee.phone.trim();
  await ref.update({
    status,
    assigned_to: assignedName || assignedEmail || null,
    assigned_to_uid: assignedUid,
    assigned_to_name: assignedName || null,
    assigned_to_email: assignedEmail || null,
    assigned_to_phone: assignedPhone || null,
    updated_at: new Date().toISOString(),
  });
  return { kind: "updated" as const, currentStatus };
}

export async function updateQuoteCommercial(reference: string, values: QuoteCommercialInput) {
  if (!configured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("quotes").doc(reference.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };

  await ref.update({
    quote_currency: values.currency,
    quoted_amount: values.quotedAmount || null,
    internal_cost: values.internalCost || null,
    valid_until: values.validUntil || null,
    customer_quote_note: values.customerNote || null,
    updated_at: new Date().toISOString(),
  });
  return { kind: "updated" as const };
}

export async function addQuoteNote(reference: string, note: string, authorName: string, authorEmail: string) {
  if (!configured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const quoteRef = db.collection("quotes").doc(normalized);
  const quoteSnapshot = await quoteRef.get();
  if (!quoteSnapshot.exists) return { kind: "missing" as const };

  const id = numericId();
  const created: QuoteNote = {
    id,
    quote_reference: normalized,
    note,
    author_name: authorName,
    author_email: authorEmail,
    created_at: new Date().toISOString(),
  };

  const batch = db.batch();
  batch.set(quoteRef.collection("notes").doc(String(id)), created);
  batch.update(quoteRef, {
    note_count: FieldValue.increment(1),
    updated_at: new Date().toISOString(),
  });
  await batch.commit();

  return { kind: "created" as const, note: created };
}
