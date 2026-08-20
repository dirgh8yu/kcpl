CREATE TABLE IF NOT EXISTS quote_admin_meta (
  quote_reference TEXT PRIMARY KEY,
  assigned_to TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_reference) REFERENCES quote_enquiries(reference) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quote_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_reference TEXT NOT NULL,
  note TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_reference) REFERENCES quote_enquiries(reference) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_notes_reference
  ON quote_notes(quote_reference, created_at DESC);
