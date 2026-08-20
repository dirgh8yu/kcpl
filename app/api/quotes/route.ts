import { env } from "cloudflare:workers";

const quoteSchema = `
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
CREATE INDEX IF NOT EXISTS idx_quote_enquiries_created_at ON quote_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_enquiries_status ON quote_enquiries(status);
`;

const allowedModes = new Set(["air", "sea", "road", "unsure"]);
const allowedWeightUnits = new Set(["kg", "tonnes", "lb"]);
const allowedDimensionUnits = new Set(["cm", "m", "in"]);

const fieldLimits = {
  origin: 120,
  destination: 120,
  cargoType: 160,
  weight: 40,
  length: 40,
  width: 40,
  height: 40,
  timing: 120,
  requirements: 3000,
  contactName: 120,
  contactEmail: 254,
  companyName: 160,
  phone: 80,
} as const;

type QuotePayload = {
  origin?: unknown;
  destination?: unknown;
  mode?: unknown;
  cargoType?: unknown;
  weight?: unknown;
  weightUnit?: unknown;
  length?: unknown;
  width?: unknown;
  height?: unknown;
  dimensionUnit?: unknown;
  timing?: unknown;
  requirements?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  companyName?: unknown;
  phone?: unknown;
  website?: unknown;
};

type CleanQuote = {
  origin: string;
  destination: string;
  mode: string;
  cargoType: string;
  weight: string;
  weightUnit: string;
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  timing: string;
  requirements: string;
  contactName: string;
  contactEmail: string;
  companyName: string;
  phone: string;
};

let schemaReady: Promise<void> | null = null;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validate(payload: QuotePayload): { data?: CleanQuote; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const values = {
    origin: text(payload.origin),
    destination: text(payload.destination),
    mode: text(payload.mode),
    cargoType: text(payload.cargoType),
    weight: text(payload.weight),
    weightUnit: text(payload.weightUnit) || "kg",
    length: text(payload.length),
    width: text(payload.width),
    height: text(payload.height),
    dimensionUnit: text(payload.dimensionUnit) || "cm",
    timing: text(payload.timing),
    requirements: text(payload.requirements),
    contactName: text(payload.contactName),
    contactEmail: text(payload.contactEmail).toLowerCase(),
    companyName: text(payload.companyName),
    phone: text(payload.phone),
  };

  for (const [field, max] of Object.entries(fieldLimits)) {
    const value = values[field as keyof typeof values];
    if (value.length > max) errors[field] = `Must be ${max} characters or fewer.`;
  }

  if (!values.origin) errors.origin = "Origin is required.";
  if (!values.destination) errors.destination = "Destination is required.";
  if (!values.contactName) errors.contactName = "Name is required.";
  if (!values.contactEmail) errors.contactEmail = "Email is required.";
  if (!allowedModes.has(values.mode)) errors.mode = "Choose a valid freight mode.";
  if (!allowedWeightUnits.has(values.weightUnit)) errors.weightUnit = "Choose a valid weight unit.";
  if (!allowedDimensionUnits.has(values.dimensionUnit)) errors.dimensionUnit = "Choose a valid dimension unit.";
  if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) errors.contactEmail = "Enter a valid email address.";

  if (Object.keys(errors).length) return { errors };
  return { data: values };
}

function getDatabase() {
  return (env as unknown as { DB?: D1Database }).DB;
}

async function ensureSchema(db: D1Database) {
  if (!schemaReady) {
    schemaReady = (async () => {
      const existing = await db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'quote_enquiries'
      `).first<{ name: string }>();

      if (existing?.name === "quote_enquiries") return;
      await db.exec(quoteSchema);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  await schemaReady;
}

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `KCPL-Q-${date}-${suffix}`;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "Send the enquiry as JSON." }, 415);
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin) {
    try {
      if (new URL(requestOrigin).host !== new URL(request.url).host) {
        return json({ ok: false, error: "Cross-origin submissions are not accepted." }, 403);
      }
    } catch {
      return json({ ok: false, error: "Invalid request origin." }, 403);
    }
  }

  let payload: QuotePayload;
  try {
    payload = await request.json() as QuotePayload;
  } catch {
    return json({ ok: false, error: "The enquiry could not be read." }, 400);
  }

  if (text(payload.website)) {
    return json({ ok: false, error: "The enquiry could not be submitted." }, 400);
  }

  const validated = validate(payload);
  if (!validated.data) {
    return json({ ok: false, error: "Please check the highlighted details.", fields: validated.errors }, 400);
  }

  const db = getDatabase();
  if (!db) {
    return json({ ok: false, error: "Quote storage is not configured yet. Please email KCPL instead." }, 503);
  }

  const quote = validated.data;
  const reference = createReference();

  try {
    await ensureSchema(db);
    await db.prepare(`
      INSERT INTO quote_enquiries (
        reference, origin, destination, mode, cargo_type, weight, weight_unit,
        length, width, height, dimension_unit, timing, requirements,
        contact_name, contact_email, company_name, phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      reference,
      quote.origin,
      quote.destination,
      quote.mode,
      quote.cargoType || null,
      quote.weight || null,
      quote.weightUnit,
      quote.length || null,
      quote.width || null,
      quote.height || null,
      quote.dimensionUnit,
      quote.timing || null,
      quote.requirements || null,
      quote.contactName,
      quote.contactEmail,
      quote.companyName || null,
      quote.phone || null,
    ).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to save KCPL quote enquiry", { message });
    return json({ ok: false, error: "KCPL could not save the enquiry. Please try again or email us directly." }, 500);
  }

  return json({
    ok: true,
    reference,
    message: "Your freight enquiry has been received by KCPL.",
  }, 201);
}
