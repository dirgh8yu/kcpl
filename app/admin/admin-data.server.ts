import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb } from "../firebase-admin.server";
import {
  quoteCurrencies,
  quoteStatuses,
  type QuoteCommercialInput,
  type QuoteCrmMatch,
  type QuoteCurrency,
  type QuoteDetail,
  type QuoteNote,
  type QuoteStatus,
  type QuoteSummary,
} from "./admin-data";
import { ensureShipmentForWonQuote, getShipmentForQuote } from "../shipment-data.server";

function configured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
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

function summaryFromData(reference: string, data: Record<string, unknown>): QuoteSummary {
  return {
    reference,
    created_at: stringValue(data.created_at),
    status: quoteStatus(data.status),
    origin: stringValue(data.origin),
    destination: stringValue(data.destination),
    mode: stringValue(data.mode),
    contact_name: stringValue(data.contact_name),
    company_name: nullableString(data.company_name),
    assigned_to: nullableString(data.assigned_to),
    note_count: Number(data.note_count ?? 0) || 0,
  };
}

function detailFromData(reference: string, data: Record<string, unknown>): Omit<QuoteDetail, "notes" | "shipment"> {
  return {
    ...summaryFromData(reference, data),
    cargo_type: nullableString(data.cargo_type),
    weight: nullableString(data.weight),
    weight_unit: nullableString(data.weight_unit),
    length: nullableString(data.length),
    width: nullableString(data.width),
    height: nullableString(data.height),
    dimension_unit: nullableString(data.dimension_unit),
    timing: nullableString(data.timing),
    requirements: nullableString(data.requirements),
    contact_email: stringValue(data.contact_email),
    phone: nullableString(data.phone),
    quote_currency: quoteCurrency(data.quote_currency),
    quoted_amount: nullableString(data.quoted_amount),
    internal_cost: nullableString(data.internal_cost),
    valid_until: nullableString(data.valid_until),
    customer_quote_note: nullableString(data.customer_quote_note),
    customer_id: nullableString(data.customer_id),
    crm_match_state: nullableString(data.crm_match_state),
    crm_matches: crmMatches(data.crm_matches),
  };
}

function numericId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

export async function listQuoteSummaries(): Promise<QuoteSummary[] | null> {
  if (!configured()) return null;
  const snapshot = await firebaseAdminDb().collection("quotes")
    .orderBy("created_at", "desc")
    .limit(200)
    .get();

  return snapshot.docs.map((doc) => summaryFromData(doc.id, doc.data() as Record<string, unknown>));
}

export async function getQuoteDetail(reference: string): Promise<QuoteDetail | null | undefined> {
  if (!configured()) return undefined;
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const quoteSnapshot = await db.collection("quotes").doc(normalized).get();
  if (!quoteSnapshot.exists) return null;

  const quote = detailFromData(normalized, quoteSnapshot.data() as Record<string, unknown>);
  const notesSnapshot = await quoteSnapshot.ref.collection("notes")
    .orderBy("created_at", "desc")
    .limit(500)
    .get();
  const notes = notesSnapshot.docs.map((doc) => doc.data() as QuoteNote);

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

  return { ...quote, shipment, notes };
}

export async function updateQuoteAdmin(reference: string, status: QuoteStatus, assignedTo: string) {
  if (!configured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("quotes").doc(reference.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  if (status === "won" && !nullableString(snapshot.get("customer_id"))) return { kind: "customer-required" as const };

  await ref.update({
    status,
    assigned_to: assignedTo || null,
    updated_at: new Date().toISOString(),
  });
  return { kind: "updated" as const };
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
