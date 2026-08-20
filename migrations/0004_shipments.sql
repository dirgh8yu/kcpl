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
