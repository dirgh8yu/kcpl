import { firebaseAdminDb } from "./firebase-admin.server";
import {
  shipmentStatusLabels,
  shipmentStatuses,
  type PublicShipmentEvent,
  type PublicShipmentTracking,
  type ShipmentDetail,
  type ShipmentEvent,
  type ShipmentStatus,
  type ShipmentUpdateInput,
} from "./shipment-types";

function configured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function shipmentStatus(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function shipmentReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `KCPL-S-${date}-${token}`;
}

function numericId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function shipmentFromData(reference: string, data: Record<string, unknown>): Omit<ShipmentDetail, "events"> {
  return {
    reference,
    quote_reference: stringValue(data.quote_reference),
    created_at: stringValue(data.created_at),
    updated_at: stringValue(data.updated_at),
    status: shipmentStatus(data.status),
    eta: nullableString(data.eta),
    current_location: nullableString(data.current_location),
    carrier: nullableString(data.carrier),
    carrier_reference: nullableString(data.carrier_reference),
    customer_note: nullableString(data.customer_note),
  };
}

async function loadEvents(reference: string) {
  const snapshot = await firebaseAdminDb().collection("shipments").doc(reference).collection("events")
    .orderBy("event_time", "desc")
    .limit(1000)
    .get();
  return snapshot.docs.map((doc) => doc.data() as ShipmentEvent);
}

async function loadShipment(reference: string): Promise<ShipmentDetail | null> {
  const normalized = reference.trim().toUpperCase();
  const snapshot = await firebaseAdminDb().collection("shipments").doc(normalized).get();
  if (!snapshot.exists) return null;
  return {
    ...shipmentFromData(normalized, snapshot.data() as Record<string, unknown>),
    events: await loadEvents(normalized),
  };
}

export async function getShipmentByReference(reference: string): Promise<ShipmentDetail | null | undefined> {
  if (!configured()) return undefined;
  return loadShipment(reference);
}

export async function getShipmentForQuote(quoteReference: string): Promise<ShipmentDetail | null | undefined> {
  if (!configured()) return undefined;
  const db = firebaseAdminDb();
  const normalized = quoteReference.trim().toUpperCase();
  const quote = await db.collection("quotes").doc(normalized).get();
  if (!quote.exists) return null;

  const directReference = nullableString(quote.data()?.shipment_reference);
  if (directReference) return loadShipment(directReference);

  const legacy = await db.collection("shipments")
    .where("quote_reference", "==", normalized)
    .limit(1)
    .get();
  if (legacy.empty) return null;
  return loadShipment(legacy.docs[0].id);
}

export async function ensureShipmentForWonQuote(quoteReference: string, authorName = "KCPL Operations") {
  if (!configured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = quoteReference.trim().toUpperCase();
  const quoteRef = db.collection("quotes").doc(normalized);

  const result = await db.runTransaction(async (transaction) => {
    const quote = await transaction.get(quoteRef);
    if (!quote.exists) return { kind: "missing" as const };
    const data = quote.data() as Record<string, unknown>;
    if (data.status !== "won") return { kind: "not-won" as const };

    const existingReference = nullableString(data.shipment_reference);
    if (existingReference) return { kind: "ready" as const, reference: existingReference };

    const reference = shipmentReference();
    const createdAt = new Date().toISOString();
    const shipmentRef = db.collection("shipments").doc(reference);
    const eventId = numericId();
    const initialEvent: ShipmentEvent = {
      id: eventId,
      shipment_reference: reference,
      title: shipmentStatusLabels.booking_confirmed,
      location: nullableString(data.origin),
      details: "KCPL has opened the shipment record and begun coordinating the movement.",
      event_time: createdAt,
      created_at: createdAt,
      author_name: authorName || "KCPL Operations",
    };

    transaction.set(shipmentRef, {
      reference,
      quote_reference: normalized,
      created_at: createdAt,
      updated_at: createdAt,
      status: "booking_confirmed",
      eta: null,
      current_location: nullableString(data.origin),
      carrier: null,
      carrier_reference: null,
      customer_note: null,
    });
    transaction.set(shipmentRef.collection("events").doc(String(eventId)), initialEvent);
    transaction.update(quoteRef, { shipment_reference: reference, updated_at: createdAt });
    return { kind: "created" as const, reference };
  });

  if (result.kind === "missing" || result.kind === "not-won") return result;
  return { kind: result.kind, shipment: await loadShipment(result.reference) } as const;
}

export async function updateShipment(reference: string, values: ShipmentUpdateInput, authorName: string) {
  if (!configured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const shipmentRef = db.collection("shipments").doc(normalized);
  const snapshot = await shipmentRef.get();
  if (!snapshot.exists) return { kind: "missing" as const };

  const currentStatus = shipmentStatus(snapshot.data()?.status);
  const updatedAt = new Date().toISOString();
  const update = {
    status: values.status,
    eta: values.eta || null,
    current_location: values.currentLocation || null,
    carrier: values.carrier || null,
    carrier_reference: values.carrierReference || null,
    customer_note: values.customerNote || null,
    updated_at: updatedAt,
  };

  if (currentStatus !== values.status) {
    const eventId = numericId();
    const event: ShipmentEvent = {
      id: eventId,
      shipment_reference: normalized,
      title: shipmentStatusLabels[values.status],
      location: values.currentLocation || null,
      details: values.customerNote || null,
      event_time: updatedAt,
      created_at: updatedAt,
      author_name: authorName || "KCPL Operations",
    };
    const batch = db.batch();
    batch.update(shipmentRef, update);
    batch.set(shipmentRef.collection("events").doc(String(eventId)), event);
    await batch.commit();
  } else {
    await shipmentRef.update(update);
  }

  return { kind: "updated" as const, shipment: await loadShipment(normalized) };
}

export async function addShipmentEvent(
  reference: string,
  values: { title: string; location: string; details: string; eventTime: string },
  authorName: string,
) {
  if (!configured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const normalized = reference.trim().toUpperCase();
  const shipmentRef = db.collection("shipments").doc(normalized);
  const snapshot = await shipmentRef.get();
  if (!snapshot.exists) return { kind: "missing" as const };

  const id = numericId();
  const createdAt = new Date().toISOString();
  const event: ShipmentEvent = {
    id,
    shipment_reference: normalized,
    title: values.title,
    location: values.location || null,
    details: values.details || null,
    event_time: values.eventTime || createdAt,
    created_at: createdAt,
    author_name: authorName || "KCPL Operations",
  };

  const batch = db.batch();
  batch.set(shipmentRef.collection("events").doc(String(id)), event);
  batch.update(shipmentRef, {
    ...(values.location ? { current_location: values.location } : {}),
    updated_at: createdAt,
  });
  await batch.commit();

  return { kind: "created" as const, event };
}

export async function getPublicShipmentTracking(reference: string): Promise<PublicShipmentTracking | null | undefined> {
  if (!configured()) return undefined;
  const normalized = reference.trim().toUpperCase();
  const shipment = await loadShipment(normalized);
  if (!shipment) return null;

  const quote = await firebaseAdminDb().collection("quotes").doc(shipment.quote_reference).get();
  if (!quote.exists) return null;
  const quoteData = quote.data() as Record<string, unknown>;

  const events: PublicShipmentEvent[] = shipment.events.map((event) => ({
    id: event.id,
    title: event.title,
    location: event.location,
    details: event.details,
    event_time: event.event_time,
  }));

  return {
    reference: shipment.reference,
    status: shipment.status,
    created_at: shipment.created_at,
    updated_at: shipment.updated_at,
    eta: shipment.eta,
    current_location: shipment.current_location,
    carrier: shipment.carrier,
    carrier_reference: shipment.carrier_reference,
    customer_note: shipment.customer_note,
    origin: stringValue(quoteData.origin),
    destination: stringValue(quoteData.destination),
    mode: stringValue(quoteData.mode),
    events,
  };
}
