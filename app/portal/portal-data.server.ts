import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { listShipmentDocuments } from "../shipment-documents.server";
import {
  portalDocumentChecklist,
  portalDocumentReleased,
  portalDocumentView,
  portalDocumentVisibleToSender,
  portalOutstandingUploads,
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
  type PortalRequirementRow,
  type PortalShipmentEventView,
  type PortalShipmentView,
} from "./portal-access-policy";
import type { PortalSession } from "./portal-auth";
import {
  freeTimeNeedsAttention,
  freeTimeStatus,
  shipmentFreeTimeFromRecord,
  type FreeTimeStatus,
  type ShipmentFreeTime,
} from "../shipment-free-time";

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

  const records = new Map<string, Record<string, unknown>>();
  snapshot.docs.forEach((document) => records.set(document.id, document.data() as Record<string, unknown>));

  return { shipments: shipments.sort(byUpdatedDescending), records };
}

export async function listPortalShipments(session: PortalSession): Promise<Unavailable | { kind: "ready"; shipments: PortalShipmentView[] }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const { shipments } = await loadCustomerShipments(session.customerId);
    return { kind: "ready", shipments };
  } catch (error) {
    console.error("KCPL portal shipment listing failed", error);
    return { kind: "unavailable" };
  }
}

export type PortalFreeTimeView = {
  freeTime: ShipmentFreeTime;
  status: FreeTimeStatus;
};

export type PortalDeliveryConfirmation = {
  confirmed_at: string;
  received_by: string | null;
};

export type PortalShipmentDetail = {
  shipment: PortalShipmentView;
  /** This account's own confirmation of receipt, when it has given one. */
  confirmation: PortalDeliveryConfirmation | null;
  /** Null when KCPL has not recorded an allowance for this shipment. */
  freeTime: PortalFreeTimeView | null;
  events: PortalShipmentEventView[];
  /** Released by KCPL, plus the customer's own submissions. */
  documents: PortalDocumentRow[];
  checklist: PortalRequirementRow[];
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

    const record = snapshot.data() as Record<string, unknown>;
    const freeTime = shipmentFreeTimeFromRecord(record);
    const freeTimeState = freeTimeStatus(freeTime, new Date().toISOString().slice(0, 10));

    const shipment = portalShipmentView(normalized, record);
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

    const confirmationId = `${session.email.replace(/[^a-z0-9]+/gi, "-")}`.slice(0, 120);
    const [eventSnapshot, documents, requirementSnapshot, confirmationSnapshot] = await Promise.all([
      snapshot.ref.collection("events").orderBy("event_time", "desc").limit(200).get(),
      listShipmentDocuments(normalized),
      snapshot.ref.collection("document_requirements").limit(100).get(),
      snapshot.ref.collection("customer_confirmations").doc(confirmationId).get(),
    ]);

    const documentRecords = documents.kind === "ready"
      ? documents.documents.map((document) => document as unknown as Record<string, unknown>)
      : [];

    return {
      kind: "ready",
      detail: {
        shipment,
        confirmation: confirmationSnapshot.exists ? {
          confirmed_at: String(confirmationSnapshot.get("created_at") ?? ""),
          received_by: typeof confirmationSnapshot.get("received_by") === "string" ? confirmationSnapshot.get("received_by") as string : null,
        } : null,
        // The internal note stays out: it is KCPL's working context, not copy
        // written for a customer.
        freeTime: freeTimeState.state === "not_set" ? null : { freeTime: { ...freeTime, note: null }, status: freeTimeState },
        events: eventSnapshot.docs.map((document) =>
          portalShipmentEventView(document.data() as Record<string, unknown>, document.id)),
        documents: documentRecords
          .filter((document) => portalDocumentVisibleToSender(document))
          .map((document) => portalDocumentRow(document, shipment)),
        // The checklist is derived from every live document, including ones the
        // customer may not see, so a line cannot read "still needed" because the
        // paper KCPL holds has not been released back to them.
        checklist: portalDocumentChecklist({
          requirements: requirementSnapshot.docs.map((requirement) => requirement.data() as Record<string, unknown>),
          documents: documentRecords,
        }),
      },
    };
  } catch (error) {
    console.error("KCPL portal shipment detail failed", error);
    return { kind: "unavailable" };
  }
}

export type PortalDocumentRow = PortalDocumentView & {
  shipment_status: string;
  /** True when this is a document the customer sent to KCPL. */
  from_customer: boolean;
  review_state: string;
};

export async function listPortalDocuments(session: PortalSession): Promise<
  Unavailable | { kind: "ready"; documents: PortalDocumentRow[]; scanned: number; total: number }
> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const { shipments } = await loadCustomerShipments(session.customerId);
    const scanned = shipments.slice(0, DOCUMENT_SHIPMENT_LIMIT);
    const results = await Promise.all(scanned.map(async (shipment) => {
      const listing = await listShipmentDocuments(shipment.reference);
      if (listing.kind !== "ready") return [] as PortalDocumentRow[];
      return listing.documents
        .map((document) => document as unknown as Record<string, unknown>)
        .filter((document) => portalDocumentVisibleToSender(document))
        .map((document) => portalDocumentRow(document, shipment));
    }));
    const documents = results.flat().sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    return { kind: "ready", documents, scanned: scanned.length, total: shipments.length };
  } catch (error) {
    console.error("KCPL portal document listing failed", error);
    return { kind: "unavailable" };
  }
}

function portalDocumentRow(document: Record<string, unknown>, shipment: PortalShipmentView): PortalDocumentRow {
  return {
    ...portalDocumentView(document, shipment.reference),
    shipment_status: shipment.status,
    from_customer: document.uploaded_by_source === "customer_portal",
    // Customer-facing review language. The staff review note is never carried.
    review_state: document.review_status === "verified"
      ? "confirmed"
      : document.review_status === "rejected"
        ? "resend"
        : document.uploaded_by_source === "customer_portal" ? "with_kcpl" : "released",
  };
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

export async function getPortalInvoice(session: PortalSession, reference: string): Promise<
  Unavailable | { kind: "forbidden" } | { kind: "missing" } | { kind: "ready"; invoice: PortalInvoiceView }
> {
  if (!session.capabilities.canViewFinance) return { kind: "forbidden" };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  const normalized = reference.trim().toUpperCase();
  if (!normalized) return { kind: "missing" };
  try {
    const snapshot = await firebaseAdminDb().collection("invoices").doc(normalized).get();
    // Scope from the session, and someone else's invoice reads as missing.
    if (!snapshot.exists || String(snapshot.get("customer_id") ?? "") !== session.customerId) return { kind: "missing" };
    const record = { ...(snapshot.data() as Record<string, unknown>), reference: snapshot.id };
    if (!portalInvoiceVisible(record)) return { kind: "missing" };
    return { kind: "ready", invoice: portalInvoiceView(record) };
  } catch (error) {
    console.error("KCPL portal invoice read failed", error);
    return { kind: "unavailable" };
  }
}

/** Ownership check for the remittance routes, before any bytes move. */
export async function portalOwnsInvoice(session: PortalSession, reference: string) {
  if (!session.capabilities.canViewFinance || !firebaseRuntimeConfigured()) return false;
  try {
    const snapshot = await firebaseAdminDb().collection("invoices").doc(reference.trim().toUpperCase()).get();
    return snapshot.exists && String(snapshot.get("customer_id") ?? "") === session.customerId;
  } catch (error) {
    console.error("KCPL portal invoice ownership check failed", error);
    return false;
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
  /** Shipments with required paperwork the customer can still supply. */
  outstanding: PortalOutstandingDocuments[];
  outstandingCount: number;
  /** Free-time clocks running out, soonest first. */
  freeTime: PortalFreeTimeRow[];
  finance: PortalFinanceSummary | null;
  quoteCount: number;
  requestCount: number;
};

export type PortalFreeTimeRow = {
  reference: string;
  origin: string;
  destination: string;
  location: string | null;
  status: FreeTimeStatus;
};

export type PortalOutstandingDocuments = {
  reference: string;
  origin: string;
  destination: string;
  rows: PortalRequirementRow[];
};

export async function getPortalOverview(session: PortalSession): Promise<Unavailable | { kind: "ready"; overview: PortalOverview }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const [shipmentSource, invoiceResult, quoteResult] = await Promise.all([
      loadCustomerShipments(session.customerId),
      listPortalInvoices(session),
      listPortalQuotes(session),
    ]);

    const shipments = shipmentSource.shipments;
    const shipmentRecords = shipmentSource.records;
    const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // The overview only looks at the shipments it already lists, so it never
    // costs more reads than the shipment workspace itself. One pass produces
    // both halves of the document story: what KCPL released, and what KCPL is
    // still waiting on from the customer.
    const recent = shipments.slice(0, 6);
    const db = firebaseAdminDb();
    const documentResults = await Promise.all(recent.map(async (shipment) => {
      const [listing, requirementSnapshot] = await Promise.all([
        listShipmentDocuments(shipment.reference),
        db.collection("shipments").doc(shipment.reference).collection("document_requirements").limit(100).get(),
      ]);
      const records = listing.kind === "ready"
        ? listing.documents.map((document) => document as unknown as Record<string, unknown>)
        : [];
      const checklist = portalDocumentChecklist({
        requirements: requirementSnapshot.docs.map((requirement) => requirement.data() as Record<string, unknown>),
        documents: records,
      });
      return {
        released: records.filter((document) => portalDocumentReleased(document)).map((document) => portalDocumentRow(document, shipment)),
        outstanding: portalOutstandingUploads(checklist),
        shipment,
      };
    }));

    // Free time rides on the shipment documents already read above, so the
    // countdown costs no extra reads.
    const freeTimeRows = shipments.length
      ? shipments
          .filter((shipment) => shipment.status !== "delivered")
          .map((shipment) => {
            const record = shipmentRecords.get(shipment.reference);
            if (!record) return null;
            const freeTime = shipmentFreeTimeFromRecord(record);
            const status = freeTimeStatus(freeTime, today);
            if (!freeTimeNeedsAttention(status)) return null;
            return {
              reference: shipment.reference,
              origin: shipment.origin,
              destination: shipment.destination,
              location: freeTime.location,
              status,
            };
          })
          .filter((row): row is PortalFreeTimeRow => row !== null)
          .sort((a, b) => a.status.daysRemaining - b.status.daysRemaining)
      : [];

    const outstanding = documentResults
      .filter((entry) => entry.outstanding.length > 0)
      .map((entry) => ({
        reference: entry.shipment.reference,
        origin: entry.shipment.origin,
        destination: entry.shipment.destination,
        rows: entry.outstanding,
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
        documents: documentResults.flatMap((entry) => entry.released)
          .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
          .slice(0, 6),
        outstanding,
        outstandingCount: outstanding.reduce((total, entry) => total + entry.rows.length, 0),
        freeTime: freeTimeRows,
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
