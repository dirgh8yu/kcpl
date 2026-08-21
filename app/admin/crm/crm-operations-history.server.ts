import type { DocumentSnapshot } from "firebase-admin/firestore";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { quoteCurrencies, quoteStatuses, type QuoteCurrency, type QuoteStatus } from "../admin-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { kcplBranches, type KcplBranch } from "./crm-data";

export type CrmQuoteHistoryItem = {
  reference: string;
  created_at: string;
  updated_at: string;
  status: QuoteStatus;
  origin: string;
  destination: string;
  mode: string;
  currency: QuoteCurrency;
  quoted_amount: string | null;
  shipment_reference: string | null;
};

export type CrmShipmentHistoryItem = {
  reference: string;
  quote_reference: string;
  created_at: string;
  updated_at: string;
  status: ShipmentStatus;
  eta: string | null;
  current_location: string | null;
  carrier: string | null;
  carrier_reference: string | null;
  origin: string;
  destination: string;
  mode: string;
};

export type CrmOperationsHistory = {
  quotes: CrmQuoteHistoryItem[];
  shipments: CrmShipmentHistoryItem[];
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function quoteStatus(value: unknown): QuoteStatus {
  return quoteStatuses.includes(value as QuoteStatus) ? value as QuoteStatus : "new";
}

function quoteCurrency(value: unknown): QuoteCurrency {
  return quoteCurrencies.includes(value as QuoteCurrency) ? value as QuoteCurrency : "USD";
}

function shipmentStatus(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function shipmentVisible(snapshot: DocumentSnapshot, context?: KcplStaffContext) {
  if (!context) return true;
  const branch = snapshot.get("primary_branch");
  if (!kcplBranches.includes(branch as KcplBranch)) return false;
  return context.can_access_all_branches || staffCanAccessBranch(context, branch as KcplBranch);
}

export async function listCrmOperationsHistory(customerId: string, context?: KcplStaffContext): Promise<CrmOperationsHistory | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();

  const [quotesSnapshot, ownedShipmentsSnapshot] = await Promise.all([
    db.collection("quotes").where("customer_id", "==", id).limit(250).get(),
    db.collection("shipments").where("customer_id", "==", id).limit(250).get(),
  ]);

  const quoteDataByReference = new Map<string, Record<string, unknown>>();
  const quotes = quotesSnapshot.docs.flatMap((doc): CrmQuoteHistoryItem[] => {
    const data = doc.data() as Record<string, unknown>;
    quoteDataByReference.set(doc.id, data);
    if (data.migration_hidden === true) return [];
    return [{
      reference: doc.id,
      created_at: text(data.created_at),
      updated_at: text(data.updated_at),
      status: quoteStatus(data.status),
      origin: text(data.origin),
      destination: text(data.destination),
      mode: text(data.mode),
      currency: quoteCurrency(data.quote_currency),
      quoted_amount: nullable(data.quoted_amount),
      shipment_reference: nullable(data.shipment_reference),
    }];
  }).sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));

  const shipmentDocs = new Map<string, DocumentSnapshot>();
  ownedShipmentsSnapshot.docs.forEach((doc) => {
    if (shipmentVisible(doc, context)) shipmentDocs.set(doc.id, doc);
  });

  const fallbackRefs = quotes
    .map((quote) => quote.shipment_reference)
    .filter((reference): reference is string => Boolean(reference) && !shipmentDocs.has(reference as string))
    .slice(0, 100)
    .map((reference) => db.collection("shipments").doc(reference));

  if (fallbackRefs.length) {
    const fallbackSnapshots = await db.getAll(...fallbackRefs);
    fallbackSnapshots.forEach((snapshot) => {
      if (snapshot.exists && shipmentVisible(snapshot, context)) shipmentDocs.set(snapshot.id, snapshot);
    });
  }

  const missingQuoteRefs = [...shipmentDocs.values()]
    .map((doc) => nullable(doc.get("quote_reference")))
    .filter((reference): reference is string => Boolean(reference) && !quoteDataByReference.has(reference as string))
    .slice(0, 100)
    .map((reference) => db.collection("quotes").doc(reference));

  if (missingQuoteRefs.length) {
    const quoteSnapshots = await db.getAll(...missingQuoteRefs);
    quoteSnapshots.forEach((snapshot) => {
      if (snapshot.exists) quoteDataByReference.set(snapshot.id, snapshot.data() as Record<string, unknown>);
    });
  }

  const shipments = [...shipmentDocs.values()].map((doc): CrmShipmentHistoryItem => {
    const data = doc.data() as Record<string, unknown>;
    const quoteReference = text(data.quote_reference);
    const quote = quoteDataByReference.get(quoteReference) ?? {};
    const hiddenMigrationQuote = quote.migration_hidden === true;
    return {
      reference: doc.id,
      quote_reference: hiddenMigrationQuote ? text(data.migration_legacy_quote_reference) : quoteReference,
      created_at: text(data.created_at),
      updated_at: text(data.updated_at),
      status: shipmentStatus(data.status),
      eta: nullable(data.eta),
      current_location: nullable(data.current_location),
      carrier: nullable(data.carrier),
      carrier_reference: nullable(data.carrier_reference),
      origin: text(quote.origin, text(data.origin)),
      destination: text(quote.destination, text(data.destination)),
      mode: text(quote.mode, text(data.mode)),
    };
  }).sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));

  const visibleShipmentRefs = new Set(shipments.map((shipment) => shipment.reference));
  const visibleQuotes = context
    ? quotes.map((quote) => quote.shipment_reference && !visibleShipmentRefs.has(quote.shipment_reference)
      ? { ...quote, shipment_reference: null }
      : quote)
    : quotes;

  return { quotes: visibleQuotes, shipments };
}
