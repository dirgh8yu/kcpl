CREATE TABLE IF NOT EXISTS quote_commercial (
  quote_reference TEXT PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'USD',
  quoted_amount TEXT,
  internal_cost TEXT,
  valid_until TEXT,
  customer_note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_reference) REFERENCES quote_enquiries(reference) ON DELETE CASCADE
);
