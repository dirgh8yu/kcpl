import { env } from "cloudflare:workers";

export const quoteStatuses = ["new", "reviewing", "quoted", "won", "lost"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export type QuoteSummary = {
  reference: string;
  created_at: string;
  status: QuoteStatus;
  origin: string;
  destination: string;
  mode: string;
  contact_name: string;
  company_name: string | null;
  assigned_to: string | null;
  note_count: number;
};

export type QuoteNote = {
  id: number;
  quote_reference: string;
  note: string;
  author_name: string;
  author_email: string;
  created_at: string;
};

export type QuoteDetail = QuoteSummary & {
  cargo_type: string | null;
  weight: string | null;
  weight_unit: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  dimension_unit: string | null;
  timing: string | null;
  requirements: string | null;
  contact_email: string;
  phone: string | null;
  notes: QuoteNote[];
};

const schema = `
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
CREATE INDEX IF NOT EXISTS idx_quote_enquiries_created_at ON quote_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_enquiries_status ON quote_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_quote_notes_reference ON quote_notes(quote_reference, created_at DESC);
`;

let schemaReady: Promise<void> | null = null;

function database() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureSchema(db: D1Database) {
  if (!schemaReady) {
    schemaReady = (async () => {
      const existing = await db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('quote_enquiries', 'quote_admin_meta', 'quote_notes')
      `).all<{ name: string }>();

      const tableNames = new Set((existing.results ?? []).map((row) => row.name));
      if (
        tableNames.has("quote_enquiries") &&
        tableNames.has("quote_admin_meta") &&
        tableNames.has("quote_notes")
      ) {
        return;
      }

      await db.exec(schema);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  await schemaReady;
}

export async function listQuoteSummaries(): Promise<QuoteSummary[] | null> {
  const db = database();
  if (!db) return null;
  await ensureSchema(db);

  const result = await db.prepare(`
    SELECT
      q.reference,
      q.created_at,
      q.status,
      q.origin,
      q.destination,
      q.mode,
      q.contact_name,
      q.company_name,
      m.assigned_to,
      COUNT(n.id) AS note_count
    FROM quote_enquiries q
    LEFT JOIN quote_admin_meta m ON m.quote_reference = q.reference
    LEFT JOIN quote_notes n ON n.quote_reference = q.reference
    GROUP BY q.reference
    ORDER BY q.created_at DESC
    LIMIT 200
  `).all<QuoteSummary>();

  return result.results ?? [];
}

export async function getQuoteDetail(reference: string): Promise<QuoteDetail | null | undefined> {
  const db = database();
  if (!db) return undefined;
  await ensureSchema(db);

  const quote = await db.prepare(`
    SELECT
      q.reference,
      q.created_at,
      q.status,
      q.origin,
      q.destination,
      q.mode,
      q.cargo_type,
      q.weight,
      q.weight_unit,
      q.length,
      q.width,
      q.height,
      q.dimension_unit,
      q.timing,
      q.requirements,
      q.contact_name,
      q.contact_email,
      q.company_name,
      q.phone,
      m.assigned_to,
      (SELECT COUNT(*) FROM quote_notes n WHERE n.quote_reference = q.reference) AS note_count
    FROM quote_enquiries q
    LEFT JOIN quote_admin_meta m ON m.quote_reference = q.reference
    WHERE q.reference = ?
  `).bind(reference).first<Omit<QuoteDetail, "notes">>();

  if (!quote) return null;

  const notes = await db.prepare(`
    SELECT id, quote_reference, note, author_name, author_email, created_at
    FROM quote_notes
    WHERE quote_reference = ?
    ORDER BY created_at DESC, id DESC
  `).bind(reference).all<QuoteNote>();

  return { ...quote, notes: notes.results ?? [] };
}

export async function updateQuoteAdmin(reference: string, status: QuoteStatus, assignedTo: string) {
  const db = database();
  if (!db) return { kind: "unavailable" as const };
  await ensureSchema(db);

  const exists = await db.prepare("SELECT reference FROM quote_enquiries WHERE reference = ?").bind(reference).first<{ reference: string }>();
  if (!exists) return { kind: "missing" as const };

  await db.batch([
    db.prepare("UPDATE quote_enquiries SET status = ? WHERE reference = ?").bind(status, reference),
    db.prepare(`
      INSERT INTO quote_admin_meta (quote_reference, assigned_to, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(quote_reference) DO UPDATE SET
        assigned_to = excluded.assigned_to,
        updated_at = excluded.updated_at
    `).bind(reference, assignedTo || null),
  ]);

  return { kind: "updated" as const };
}

export async function addQuoteNote(reference: string, note: string, authorName: string, authorEmail: string) {
  const db = database();
  if (!db) return { kind: "unavailable" as const };
  await ensureSchema(db);

  const exists = await db.prepare("SELECT reference FROM quote_enquiries WHERE reference = ?").bind(reference).first<{ reference: string }>();
  if (!exists) return { kind: "missing" as const };

  const result = await db.prepare(`
    INSERT INTO quote_notes (quote_reference, note, author_name, author_email)
    VALUES (?, ?, ?, ?)
  `).bind(reference, note, authorName, authorEmail).run();

  const id = Number(result.meta.last_row_id);
  const created = await db.prepare(`
    SELECT id, quote_reference, note, author_name, author_email, created_at
    FROM quote_notes
    WHERE id = ?
  `).bind(id).first<QuoteNote>();

  return { kind: "created" as const, note: created };
}
