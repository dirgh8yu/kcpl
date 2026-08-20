import { env } from "cloudflare:workers";
import type { ShipmentDocument, ShipmentDocumentType } from "./shipment-document-types";

const documentSchema = `
CREATE TABLE IF NOT EXISTS shipment_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_reference TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  document_type TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT NOT NULL,
  FOREIGN KEY (shipment_reference) REFERENCES shipments(reference) ON DELETE CASCADE
)
`;

let documentSchemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

function bucket() {
  return (env as unknown as { DOCUMENTS?: R2Bucket }).DOCUMENTS;
}

async function ensureDocumentSchema(db: D1Database) {
  if (!documentSchemaReady) {
    documentSchemaReady = (async () => {
      await db.prepare(documentSchema).run();
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_shipment_documents_reference ON shipment_documents(shipment_reference, uploaded_at DESC, id DESC)").run();
    })().catch((error) => {
      documentSchemaReady = null;
      throw error;
    });
  }
  await documentSchemaReady;
}

async function shipmentExists(db: D1Database, reference: string) {
  return Boolean(await db.prepare("SELECT reference FROM shipments WHERE reference = ?")
    .bind(reference)
    .first<{ reference: string }>());
}

function safeFilename(filename: string) {
  const tail = filename.split(/[\\/]/).pop() || "document";
  const cleaned = tail
    .normalize("NFKD")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "document";
}

function normalizeReference(reference: string) {
  return reference.trim().toUpperCase();
}

export async function listShipmentDocuments(reference: string) {
  const db = database();
  if (!db) return { kind: "unavailable" as const };
  await ensureDocumentSchema(db);

  const normalized = normalizeReference(reference);
  if (!await shipmentExists(db, normalized)) return { kind: "missing" as const };

  const result = await db.prepare(`
    SELECT id, shipment_reference, filename, content_type, size_bytes, document_type, uploaded_at, uploaded_by
    FROM shipment_documents
    WHERE shipment_reference = ?
    ORDER BY uploaded_at DESC, id DESC
  `).bind(normalized).all<ShipmentDocument>();

  return { kind: "ready" as const, documents: result.results ?? [], storageAvailable: Boolean(bucket()) };
}

export async function uploadShipmentDocument(
  reference: string,
  values: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    documentType: ShipmentDocumentType;
    uploadedBy: string;
    data: ArrayBuffer;
  },
) {
  const db = database();
  const documents = bucket();
  if (!db || !documents) return { kind: "unavailable" as const };
  await ensureDocumentSchema(db);

  const normalized = normalizeReference(reference);
  if (!await shipmentExists(db, normalized)) return { kind: "missing" as const };

  const key = `shipments/${normalized}/${crypto.randomUUID()}-${safeFilename(values.filename)}`;
  await documents.put(key, values.data, {
    httpMetadata: { contentType: values.contentType },
    customMetadata: {
      shipmentReference: normalized,
      originalFilename: values.filename.slice(0, 240),
    },
  });

  try {
    const result = await db.prepare(`
      INSERT INTO shipment_documents (
        shipment_reference, r2_key, filename, content_type, size_bytes, document_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      normalized,
      key,
      values.filename,
      values.contentType,
      values.sizeBytes,
      values.documentType,
      values.uploadedBy,
    ).run();

    const document = await db.prepare(`
      SELECT id, shipment_reference, filename, content_type, size_bytes, document_type, uploaded_at, uploaded_by
      FROM shipment_documents
      WHERE id = ?
    `).bind(Number(result.meta.last_row_id)).first<ShipmentDocument>();

    return { kind: "created" as const, document };
  } catch (error) {
    await documents.delete(key).catch(() => undefined);
    throw error;
  }
}

export async function getShipmentDocumentFile(reference: string, id: number) {
  const db = database();
  const documents = bucket();
  if (!db || !documents) return { kind: "unavailable" as const };
  await ensureDocumentSchema(db);

  const normalized = normalizeReference(reference);
  const document = await db.prepare(`
    SELECT id, shipment_reference, r2_key, filename, content_type, size_bytes, document_type, uploaded_at, uploaded_by
    FROM shipment_documents
    WHERE shipment_reference = ? AND id = ?
  `).bind(normalized, id).first<ShipmentDocument & { r2_key: string }>();
  if (!document) return { kind: "missing" as const };

  const object = await documents.get(document.r2_key);
  if (!object) return { kind: "object-missing" as const, document };
  return { kind: "ready" as const, document, object };
}

export async function deleteShipmentDocument(reference: string, id: number) {
  const db = database();
  const documents = bucket();
  if (!db || !documents) return { kind: "unavailable" as const };
  await ensureDocumentSchema(db);

  const normalized = normalizeReference(reference);
  const document = await db.prepare(`
    SELECT id, shipment_reference, r2_key, filename, content_type, size_bytes, document_type, uploaded_at, uploaded_by
    FROM shipment_documents
    WHERE shipment_reference = ? AND id = ?
  `).bind(normalized, id).first<ShipmentDocument & { r2_key: string }>();
  if (!document) return { kind: "missing" as const };

  await documents.delete(document.r2_key);
  await db.prepare("DELETE FROM shipment_documents WHERE id = ? AND shipment_reference = ?")
    .bind(id, normalized)
    .run();
  return { kind: "deleted" as const };
}
