/*
 * Carrier free-time ingestion.
 *
 * Carriers and terminals publish the allowance as a number of days from a
 * clock-start date, usually discharge or gate-in. Staff currently type that
 * into the Job File. This parser is the boundary for the automated path: it
 * accepts exactly the fields the free-time record owns and refuses anything
 * that could overwrite a canonical shipment field.
 */

export const freeTimeIngestBearers = ["customer", "kcpl", "undecided"] as const;
export type FreeTimeIngestBearer = (typeof freeTimeIngestBearers)[number];

export type FreeTimeIngest = {
  reference: string;
  location: string;
  days: number;
  started_on: string;
  ended_on: string | null;
  daily_charge: number | null;
  charge_currency: string | null;
  bearer: FreeTimeIngestBearer;
  note: string | null;
  provider: string;
  provider_event_id: string;
};

export type FreeTimeIngestResult =
  | { ok: true; value: FreeTimeIngest }
  | { ok: false; error: string };

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionalDay(value: unknown) {
  const day = text(value, 10);
  if (!day) return null;
  return validDay(day) ? day : undefined;
}

export function parseFreeTimeIngest(body: Record<string, unknown>): FreeTimeIngestResult {
  const reference = text(body.reference, 160).toUpperCase();
  if (!reference) return { ok: false, error: "reference is required." };
  const location = text(body.location, 180);
  if (!location) return { ok: false, error: "location is required." };

  const daysRaw = typeof body.days === "number" ? body.days : Number(body.days);
  if (!Number.isInteger(daysRaw) || daysRaw < 0 || daysRaw > 365) return { ok: false, error: "days must be a whole number from 0 to 365." };

  const started = text(body.started_on ?? body.startedOn, 10);
  if (!validDay(started)) return { ok: false, error: "started_on must be a calendar day (YYYY-MM-DD)." };
  const ended = optionalDay(body.ended_on ?? body.endedOn);
  if (ended === undefined) return { ok: false, error: "ended_on must be a calendar day (YYYY-MM-DD)." };
  if (ended && ended < started) return { ok: false, error: "ended_on cannot be before started_on." };

  const chargeRaw = body.daily_charge ?? body.dailyCharge;
  const dailyCharge = chargeRaw === null || chargeRaw === undefined || chargeRaw === "" ? null : Number(chargeRaw);
  if (dailyCharge !== null && (!Number.isFinite(dailyCharge) || dailyCharge < 0 || dailyCharge > 10_000_000)) {
    return { ok: false, error: "daily_charge must be zero or greater." };
  }
  const currencyRaw = text(body.charge_currency ?? body.chargeCurrency, 3).toUpperCase();
  if (dailyCharge !== null && !/^[A-Z]{3}$/.test(currencyRaw)) return { ok: false, error: "charge_currency is required with daily_charge." };

  const bearerRaw = text(body.bearer, 20) as FreeTimeIngestBearer;
  const bearer = freeTimeIngestBearers.includes(bearerRaw) ? bearerRaw : "undecided";
  const provider = text(body.provider, 120) || "Carrier feed";
  const providerEventId = text(body.provider_event_id ?? body.providerEventId, 240);
  if (!providerEventId) return { ok: false, error: "provider_event_id is required for idempotent ingestion." };

  return {
    ok: true,
    value: {
      reference,
      location,
      days: daysRaw,
      started_on: started,
      ended_on: ended,
      daily_charge: dailyCharge,
      charge_currency: dailyCharge === null ? null : currencyRaw,
      bearer,
      note: text(body.note, 500) || null,
      provider,
      provider_event_id: providerEventId,
    },
  };
}
