import { env } from "cloudflare:workers";
import {
  shipmentStatusLabels,
  type PublicShipmentEvent,
  type PublicShipmentTracking,
  type ShipmentDetail,
  type ShipmentEvent,
  type ShipmentUpdateInput,
} from "./shipment-types";

const shipmentSchema = `
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  quote_reference TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'booking_confirmed',
  eta TEXT,
  current_location TEXT,
  carrier TEXT,
  carrier_reference TEXT,
  customer_note TEXT,
  FOREIGN KEY (quote_reference) REFERENCES quote_enquiries(reference) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS shipment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_reference TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  details TEXT,
  event_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  author_name TEXT NOT NULL,
  FOREIGN KEY (shipment_reference) REFERENCES shipments(reference) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shipments_quote_reference ON shipments(quote_reference);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipment_events_reference_time ON shipment_events(shipment_reference, event_time DESC, id DESC);
`;

let shipmentSchemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureShipmentSchema(db: D1Database) {
  if (!shipmentSchemaReady) {
    shipmentSchemaReady = db.exec(shipmentSchema).then(() => undefined).catch((error) => {
      shipmentSchemaReady = null;
      throw error;
    });
  }
  await shipmentSchemaReady;
}

function shipmentReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `KCPL-S-${date}-${token}`;
}

async function loadEvents(db: D1Database, reference: string) {
  const result = await db.prepare(`
    SELECT id, shipment_reference, title, location, details, event_time, created_at, author_name
    FROM shipment_events
    WHERE shipment_reference = ?
    ORDER BY event_time DESC, id DESC
  `).bind(reference).all<ShipmentEvent>();
  return result.results ?? [];
}

async function loadShipment(db: D1Database, reference: string): Promise<ShipmentDetail | null> {
  const shipment = await db.prepare(`
    SELECT reference, quote_reference, created_at, updated_at, status, eta,
           current_location, carrier, carrier_reference, customer_note
    FROM shipments
    WHERE reference = ?
  `).bind(reference).first<Omit<ShipmentDetail, "events">>();
  if (!shipment) return null;
  return { ...shipment, events: await loadEvents(db, reference) };
}

export async function getShipmentByReference(reference: string): Promise<ShipmentDetail | null | undefined> {
  const db = database();
  if (!db) return undefined;
  await ensureShipmentSchema(db);
  return loadShipment(db, reference.trim().toUpperCase());
}

export async function getShipmentForQuote(quoteReference: string): Promise<ShipmentDetail | null | undefined> {
  const db = database();
  if (!db) return undefined;
  await ensureShipmentSchema(db);
  const row = await db.prepare("SELECT reference FROM shipments WHERE quote_reference = ?")
    .bind(quoteReference)
    .first<{ reference: string }>();
  if (!row) return null;
  return loadShipment(db, row.reference);
}

export async function ensureShipmentForWonQuote(quoteReference: string, authorName = "KCPL Operations") {
  const db = database();
  if (!db) return { kind: "unavailable" as const };
  await ensureShipmentSchema(db);

  const quote = await db.prepare("SELECT reference, status, origin FROM quote_enquiries WHERE reference = ?")
    .bind(quoteReference)
    .first<{ reference: string; status: string; origin: string }>();
  if (!quote) return { kind: "missing" as const };
  if (quote.status !== "won") return { kind: "not-won" as const };

  const existing = await db.prepare("SELECT reference FROM shipments WHERE quote_reference = ?")
    .bind(quoteReference)
    .first<{ reference: string }>();
  if (existing) {
    return { kind: "ready" as const, shipment: await loadShipment(db, existing.reference) };
  }

  const reference = shipmentReference();
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO shipments (reference, quote_reference, status, current_location)
        VALUES (?, ?, 'booking_confirmed', ?)
      `).bind(reference, quoteReference, quote.origin || null),
      db.prepare(`
        INSERT INTO shipment_events (shipment_reference, title, location, details, author_name)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        reference,
        shipmentStatusLabels.booking_confirmed,
        quote.origin || null,
        "KCPL has opened the shipment record and begun coordinating the movement.",
        authorName || "KCPL Operations",
      ),
    ]);
  } catch (error) {
    const raced = await db.prepare("SELECT reference FROM shipments WHERE quote_reference = ?")
      .bind(quoteReference)
      .first<{ reference: string }>();
    if (!raced) throw error;
    return { kind: "ready" as const, shipment: await loadShipment(db, raced.reference) };
  }

  return { kind: "created" as const, shipment: await loadShipment(db, reference) };
}

export async function updateShipment(reference: string, values: ShipmentUpdateInput, authorName: string) {
  const db = database();
  if (!db) return { kind: "unavailable" as const };
  await ensureShipmentSchema(db);

  const normalized = reference.trim().toUpperCase();
  const current = await db.prepare("SELECT status FROM shipments WHERE reference = ?")
    .bind(normalized)
    .first<{ status: string }>();
  if (!current) return { kind: "missing" as const };

  const update = db.prepare(`
    UPDATE shipments
    SET status = ?, eta = ?, current_location = ?, carrier = ?, carrier_reference = ?, customer_note = ?, updated_at = CURRENT_TIMESTAMP
    WHERE reference = ?
  `).bind(
    values.status,
    values.eta || null,
    values.currentLocation || null,
    values.carrier || null,
    values.carrierReference || null,
    values.customerNote || null,
    normalized,
  );

  if (current.status !== values.status) {
    await db.batch([
      update,
      db.prepare(`
        INSERT INTO shipment_events (shipment_reference, title, location, details, author_name)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        normalized,
        shipmentStatusLabels[values.status],
        values.currentLocation || null,
        values.customerNote || null,
        authorName || "KCPL Operations",
      ),
    ]);
  } else {
    await update.run();
  }

  return { kind: "updated" as const, shipment: await loadShipment(db, normalized) };
}

export async function addShipmentEvent(
  reference: string,
  values: { title: string; location: string; details: string; eventTime: string },
  authorName: string,
) {
  const db = database();
  if (!db) return { kind: "unavailable" as const };
  await ensureShipmentSchema(db);

  const normalized = reference.trim().toUpperCase();
  const exists = await db.prepare("SELECT reference FROM shipments WHERE reference = ?")
    .bind(normalized)
    .first<{ reference: string }>();
  if (!exists) return { kind: "missing" as const };

  const result = await db.prepare(`
    INSERT INTO shipment_events (shipment_reference, title, location, details, event_time, author_name)
    VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)
  `).bind(
    normalized,
    values.title,
    values.location || null,
    values.details || null,
    values.eventTime || null,
    authorName || "KCPL Operations",
  ).run();

  await db.prepare(`
    UPDATE shipments
    SET current_location = COALESCE(?, current_location), updated_at = CURRENT_TIMESTAMP
    WHERE reference = ?
  `).bind(values.location || null, normalized).run();

  const event = await db.prepare(`
    SELECT id, shipment_reference, title, location, details, event_time, created_at, author_name
    FROM shipment_events
    WHERE id = ?
  `).bind(Number(result.meta.last_row_id)).first<ShipmentEvent>();

  return { kind: "created" as const, event };
}

export async function getPublicShipmentTracking(reference: string): Promise<PublicShipmentTracking | null | undefined> {
  const db = database();
  if (!db) return undefined;
  await ensureShipmentSchema(db);

  const normalized = reference.trim().toUpperCase();
  const shipment = await db.prepare(`
    SELECT
      s.reference,
      s.status,
      s.created_at,
      s.updated_at,
      s.eta,
      s.current_location,
      s.carrier,
      s.carrier_reference,
      s.customer_note,
      q.origin,
      q.destination,
      q.mode
    FROM shipments s
    JOIN quote_enquiries q ON q.reference = s.quote_reference
    WHERE s.reference = ?
  `).bind(normalized).first<Omit<PublicShipmentTracking, "events">>();

  if (!shipment) return null;

  const events = await db.prepare(`
    SELECT id, title, location, details, event_time
    FROM shipment_events
    WHERE shipment_reference = ?
    ORDER BY event_time DESC, id DESC
  `).bind(normalized).all<PublicShipmentEvent>();

  return { ...shipment, events: events.results ?? [] };
}
