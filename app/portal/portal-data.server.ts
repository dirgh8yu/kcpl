import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { listShipmentDocuments } from "../shipment-documents.server";
import {
  portalDocumentReleased,
  portalDocumentView,
  portalInvoiceView,
  portalInvoiceVisible,
  portalQuoteView,
  portalQuoteVisible,
  portalShipmentActive,
  portalShipmentEventView,
  portalShipmentView,
  type PortalDocumentView,
  type PortalInvoiceView,
  type PortalQuoteView,
  type PortalShipmentEventView,
  type PortalShipmentView,
} from "./portal-access-policy";
import type { PortalSession } from "./portal-auth";

/*
 * Every reader in this module takes the resolved session and scopes its query
 * by `session.customerId`. No function here accepts a customer id from a
 * caller, so a portal route cannot widen its own scope by passing one in.
 *
 * Reads are bounded and sorted in memory rather than by Firestore `orderBy`,
 * which keeps the portal on the single-field `customer_id` index the staff
 * product already relies on instead of requiring new composite indexes.
 */

const SHIPMENT_SCAN_LIMIT = 500;
const INVOICE_SCAN_LIMIT = 500;
const QUOTE_SCAN_LIMIT = 250;
/** Documents live in a subcollection per shipment, so a cross-shipment view
 * costs one read per shipment. The document workspace therefore covers the
 * most recently updated shipments rather than the entire history. */
const DOCUMENT_SHIPMENT_LIMIT = 40;

type Unavailable = { kind: "unavailable" };

function byUpdatedDescending(a: { updated_at: string }, b: { updated_at: string }) {
  return b.updated_at.localeCompare(a.updated_at);
}

function isoDay(value: string) {
  return value.slice(0, 10);
}

async function loadCustomerShipments(customerId: string) {
  const db = firebaseAdminDb();
  const snapshot = await db.collection("shipments")
    .where("customer_id", "==", customerId)
    .limit(SHIPMENT_SCAN_LIMIT)
    .get();

  const shipments = snapshot.docs.map((document) =>
    portalShipmentView(document.id, document.data() as Record<string, unknown>));

  // Legacy shipments carry no lane of their own: origin, destination and mode
  // live on the quote they were opened from, exactly as the public tracking
  // page resolves them. Backfill in one batched read rather than per row.
  const missing = snapshot.docs
    .map((document, index) => ({ index, quote: document.get("quote_reference") as unknown }))
    .filter((entry) => !shipments[entry.index].origin && typeof entry.quote === "string" && entry.quote.trim());
  if (missing.length) {
    const references = missing.slice(0, SHIPMENT_SCAN_LIMIT)
      .map((entry) => db.collection("quotes").doc(String(entry.quote).trim()));
    const quotes = await db.getAll(...references);
    quotes.forEach((quote, position) => {
      if (!quote.exists) return;
      const target = shipments[missing[position].index];
      target.origin = target.origin || String(quote.get("origin") ?? "");
      target.destination = target.destination || String(quote.get("destination") ?? "");
      target.mode = target.mode === "unsure" ? String(quote.get("mode") ?? "unsure") : target.mode;
    });
  }

  return shipments.sort(byUpdatedDescending);
}

export async function listPortalShipments(session: PortalSession): Promise<Unavailable | { kind: "ready"; shipments: PortalShipmentView[] }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    return { kind: "ready", shipments: await loadCustomerShipments(session.customerId) };
  } catch (error) {
    console.error("KCPL portal shipment listing failed", error);
    return { kind: "unavailable" };
  }
}

export type PortalShipmentDetail = {
  shipment: PortalShipmentView;
  events: PortalShipmentEventView[];
  documents: PortalDocumentView[];
};

export async function getPortalShipment(session: PortalSession, reference: string): Promise<
  Unavailable | { kind: "missing" } | { kind: "ready"; detail: PortalShipmentDetail }
> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  const normalized = reference.trim().toUpperCase();
  if (!normalized) return { kind: "missing" };

  try {
    const db = firebaseAdminDb();
    const snapshot = await db.collection("shipments").doc(normalized).get();
    // Ownership is checked against the session, and a shipment that belongs to
    // another customer is reported as missing rather than forbidden: a 403
    // would confirm that the reference exists.
    if (!snapshot.exists || String(snapshot.get("customer_id") ?? "") !== session.customerId) return { kind: "missing" };

    const shipment = portalShipmentView(normalized, snapshot.data() as Record<string, unknown>);
    if (!shipment.origin) {
      const quoteReference = String(snapshot.get("quote_reference") ?? "").trim();
      if (quoteReference) {
        const quote = await db.collection("quotes").doc(quoteReference).get();
        if (quote.exists) {
          shipment.origin = String(quote.get("origin") ?? "");
          shipment.destination = String(quote.get("destination") ?? "");
          if (shipment.mode === "unsure") shipment.mode = String(quote.get("mode") ?? "unsure");
        }
      }
    }

    const [eventSnapshot, documents] = await Promise.all([
      snapshot.ref.collection("events").orderBy("event_time", "desc").limit(200).get(),
      listShipmentDocuments(normalized),
    ]);

    return {
      kind: "ready",
      detail: {
        shipment,
        events: eventSnapshot.docs.map((document) =>
          portalShipmentEventView(document.data() as Record<string, unknown>, document.id)),
        documents: documents.kind === "ready"
          ? documents.documents
              .filter((document) => portalDocumentReleased(document as unknown as Record<string, unknown>))
              .map((document) => portalDocumentView(document as unknown as Record<string, unknown>, normalized))
          : [],
      },
    };
  } catch (error) {
    console.error("KCPL portal shipment detail failed", error);
    return { kind: "unavailable" };
  }
}

export type PortalDocumentRow = PortalDocumentView & { shipment_status: string };

export async function listPortalDocuments(session: PortalSession): Promise<
  Unavailable | { kind: "ready"; documents: PortalDocumentRow[]; scanned: number; total: number }
> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const shipments = await loadCustomerShipments(session.customerId);
    const scanned = shipments.slice(0, DOCUMENT_SHIPMENT_LIMIT);
    const results = await Promise.all(scanned.map(async (shipment) => {
      const listing = await listShipmentDocuments(shipment.reference);
      if (listing.kind !== "ready") return [] as PortalDocumentRow[];
      return listing.documents
        .filter((document) => portalDocumentReleased(document as unknown as Record<string, unknown>))
        .map((document) => ({
          ...portalDocumentView(document as unknown as Record<string, unknown>, shipment.reference),
          shipment_status: shipment.status,
        }));
    }));
    const documents = results.flat().sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    return { kind: "ready", documents, scanned: scanned.length, total: shipments.length };
  } catch (error) {
    console.error("KCPL portal document listing failed", error);
    return { kind: "unavailable" };
  }
}

export type PortalCurrencyBalance = {
  currency: string;
  invoiced: number;
  paid: number;
  outstanding: number;
  overdue: number;
};

export type PortalFinanceSummary = {
  balances: PortalCurrencyBalance[];
  openInvoices: number;
  overdueInvoices: number;
};

function summarizeInvoices(invoices: PortalInvoiceView[], today: string): PortalFinanceSummary {
  const byCurrency = new Map<string, PortalCurrencyBalance>();
  let openInvoices = 0;
  let overdueInvoices = 0;

  for (const invoice of invoices) {
    const balance = byCurrency.get(invoice.currency)
      ?? { currency: invoice.currency, invoiced: 0, paid: 0, outstanding: 0, overdue: 0 };
    balance.invoiced += invoice.total;
    balance.paid += invoice.amount_paid;
    balance.outstanding += invoice.balance_due;
    const overdue = invoice.balance_due > 0
      && (invoice.status === "overdue" || (Boolean(invoice.due_date) && isoDay(invoice.due_date) < today));
    if (overdue) {
      balance.overdue += invoice.balance_due;
      overdueInvoices += 1;
    }
    if (invoice.balance_due > 0) openInvoices += 1;
    byCurrency.set(invoice.currency, balance);
  }

  return {
    balances: [...byCurrency.values()].sort((a, b) => b.outstanding - a.outstanding),
    openInvoices,
    overdueInvoices,
  };
}

export async function listPortalInvoices(session: PortalSession): Promise<
  Unavailable | { kind: "forbidden" } | { kind: "ready"; invoices: PortalInvoiceView[]; summary: PortalFinanceSummary }
> {
  if (!session.capabilities.canViewFinance) return { kind: "forbidden" };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const snapshot = await firebaseAdminDb().collection("invoices")
      .where("customer_id", "==", session.customerId)
      .limit(INVOICE_SCAN_LIMIT)
      .get();
    const invoices = snapshot.docs
      .map((document) => ({ ...(document.data() as Record<string, unknown>), reference: document.id }))
      .filter(portalInvoiceVisible)
      .map(portalInvoiceView)
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date));
    return {
      kind: "ready",
      invoices,
      summary: summarizeInvoices(invoices, new Date().toISOString().slice(0, 10)),
    };
  } catch (error) {
    console.error("KCPL portal invoice listing failed", error);
    return { kind: "unavailable" };
  }
}

export async function listPortalQuotes(session: PortalSession): Promise<
  Unavailable | { kind: "ready"; quotes: PortalQuoteView[]; requests: PortalQuoteView[] }
> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    // `customer_id` is the CRM link a staff member confirmed. `portal_customer_id`
    // is written by the portal itself when a customer raises a request, before
    // staff have linked it -- the portal must see its own submissions without
    // pre-empting the staff-owned CRM match.
    const [linked, raised] = await Promise.all([
      db.collection("quotes").where("customer_id", "==", session.customerId).limit(QUOTE_SCAN_LIMIT).get(),
      db.collection("quotes").where("portal_customer_id", "==", session.customerId).limit(QUOTE_SCAN_LIMIT).get(),
    ]);

    const records = new Map<string, Record<string, unknown>>();
    for (const document of [...linked.docs, ...raised.docs]) {
      records.set(document.id, { ...(document.data() as Record<string, unknown>), reference: document.id });
    }

    const all = [...records.values()];
    const quotes = all.filter(portalQuoteVisible).map(portalQuoteView)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const requests = all.filter((record) => !portalQuoteVisible(record)).map(portalQuoteView)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { kind: "ready", quotes, requests };
  } catch (error) {
    console.error("KCPL portal quote listing failed", error);
    return { kind: "unavailable" };
  }
}

export type PortalOverview = {
  shipments: PortalShipmentView[];
  activeCount: number;
  inTransitCount: number;
  arrivingCount: number;
  attentionCount: number;
  deliveredCount: number;
  documents: PortalDocumentRow[];
  finance: PortalFinanceSummary | null;
  quoteCount: number;
  requestCount: number;
};

export async function getPortalOverview(session: PortalSession): Promise<Unavailable | { kind: "ready"; overview: PortalOverview }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const [shipmentResult, invoiceResult, quoteResult] = await Promise.all([
      listPortalShipments(session),
      listPortalInvoices(session),
      listPortalQuotes(session),
    ]);
    if (shipmentResult.kind !== "ready") return { kind: "unavailable" };

    const shipments = shipmentResult.shipments;
    const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // The overview only surfaces documents for the shipments it already lists,
    // so it never costs more reads than the shipment workspace itself.
    const recent = shipments.slice(0, 6);
    const documentResults = await Promise.all(recent.map(async (shipment) => {
      const listing = await listShipmentDocuments(shipment.reference);
      if (listing.kind !== "ready") return [] as PortalDocumentRow[];
      return listing.documents
        .filter((document) => portalDocumentReleased(document as unknown as Record<string, unknown>))
        .map((document) => ({
          ...portalDocumentView(document as unknown as Record<string, unknown>, shipment.reference),
          shipment_status: shipment.status,
        }));
    }));

    return {
      kind: "ready",
      overview: {
        shipments,
        activeCount: shipments.filter((shipment) => portalShipmentActive(shipment.status)).length,
        inTransitCount: shipments.filter((shipment) => shipment.status === "in_transit").length,
        arrivingCount: shipments.filter((shipment) =>
          portalShipmentActive(shipment.status)
          && shipment.eta
          && isoDay(shipment.eta) >= today
          && isoDay(shipment.eta) <= horizon).length,
        attentionCount: shipments.filter((shipment) => shipment.status === "exception").length,
        deliveredCount: shipments.filter((shipment) => shipment.status === "delivered").length,
        documents: documentResults.flat().sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)).slice(0, 6),
        finance: invoiceResult.kind === "ready" ? invoiceResult.summary : null,
        quoteCount: quoteResult.kind === "ready" ? quoteResult.quotes.length : 0,
        requestCount: quoteResult.kind === "ready" ? quoteResult.requests.length : 0,
      },
    };
  } catch (error) {
    console.error("KCPL portal overview failed", error);
    return { kind: "unavailable" };
  }
}

/** Ownership check used by the document download route before any bytes are read. */
export async function portalOwnsShipment(session: PortalSession, reference: string) {
  if (!firebaseRuntimeConfigured()) return false;
  try {
    const snapshot = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).get();
    return snapshot.exists && String(snapshot.get("customer_id") ?? "") === session.customerId;
  } catch (error) {
    console.error("KCPL portal shipment ownership check failed", error);
    return false;
  }
}
