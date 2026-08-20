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
);

CREATE INDEX IF NOT EXISTS idx_shipment_documents_reference
ON shipment_documents(shipment_reference, uploaded_at DESC, id DESC);
