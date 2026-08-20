CREATE TABLE IF NOT EXISTS quote_enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'new',
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  mode TEXT NOT NULL,
  cargo_type TEXT,
  weight TEXT,
  weight_unit TEXT,
  length TEXT,
  width TEXT,
  height TEXT,
  dimension_unit TEXT,
  timing TEXT,
  requirements TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  company_name TEXT,
  phone TEXT
);

CREATE INDEX IF NOT EXISTS idx_quote_enquiries_created_at
  ON quote_enquiries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_enquiries_status
  ON quote_enquiries(status);
