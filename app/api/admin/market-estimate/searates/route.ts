import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

const SEARATES_BASE = "https://rates.searates.com/api/v1/freight-index";
const DICTIONARY_TTL_MS = 6 * 60 * 60 * 1000;
const ESTIMATE_TTL_MS = 15 * 60 * 1000;

const supportedModes = ["air", "LCL", "FCL", "LTL", "FTL"] as const;
type SupportedMode = (typeof supportedModes)[number];
type LocationType = "CITY" | "PORT" | "AIRPORT";
type LoadType = "boxes" | "crate" | "pallets" | "container20" | "container40" | "container40HC";

type DictionaryCache = { expiresAt: number; value: ShippingType[] };
type EstimateCache = { expiresAt: number; value: unknown };

type ShippingType = {
  id: number | string;
  name?: string;
  short_name?: string;
  full_name?: string;
  type?: string;
  transport_unit_types?: Array<{
    id: number | string;
    name?: string;
    short_name?: string;
    category?: string;
    group?: string;
  }>;
};

type SeaRatesLocation = {
  id: number | string;
  name?: string;
  short_name?: string;
  country?: string;
  latitude?: string | number;
  longitude?: string | number;
};

let shippingTypesCache: DictionaryCache | null = null;
const estimateCache = new Map<string, EstimateCache>();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function wholeNumber(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 99 ? parsed : fallback;
}

function apiKey() {
  return text(process.env.SEARATES_FREIGHT_INDEX_API_KEY, 512);
}

function preferredLocationTypes(mode: SupportedMode): LocationType[] {
  if (mode === "air") return ["AIRPORT", "CITY"];
  if (mode === "FCL" || mode === "LCL") return ["PORT", "CITY"];
  return ["CITY"];
}

async function seaRatesFetch(path: string, key: string, init?: RequestInit) {
  const response = await fetch(`${SEARATES_BASE}/${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": key,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { response, payload };
}

async function getShippingTypes(key: string) {
  if (shippingTypesCache && shippingTypesCache.expiresAt > Date.now()) return shippingTypesCache.value;

  const { response, payload } = await seaRatesFetch("get/dictionary/shipping-types?include_transport_units=true", key);
  if (!response.ok || !payload || typeof payload !== "object") throw new Error("SeaRates shipping-type dictionary is unavailable.");

  const data = (payload as Record<string, unknown>).data;
  const rows = Array.isArray(data) ? data.filter((item): item is ShippingType => Boolean(item && typeof item === "object")) : [];
  if (!rows.length) throw new Error("SeaRates returned an empty shipping-type dictionary.");

  shippingTypesCache = { expiresAt: Date.now() + DICTIONARY_TTL_MS, value: rows };
  return rows;
}

function normalize(value: unknown) {
  return text(value, 80).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function shippingTypeForMode(rows: ShippingType[], mode: SupportedMode) {
  const wanted = mode.toUpperCase();
  return rows.find((row) => {
    const values = [row.name, row.short_name, row.full_name].map(normalize);
    return values.includes(wanted);
  }) ?? null;
}

function transportUnitForLoad(type: ShippingType, loadType: LoadType) {
  if (loadType === "container20") {
    const candidates = new Set(["ST20", "20ST", "20STANDARD", "20STANDARD"]);
    return type.transport_unit_types?.find((item) => candidates.has(normalize(item.short_name)) || candidates.has(normalize(item.name))) ?? null;
  }
  if (loadType === "container40") {
    const candidates = new Set(["ST40", "40ST", "40STANDARD"]);
    return type.transport_unit_types?.find((item) => candidates.has(normalize(item.short_name)) || candidates.has(normalize(item.name))) ?? null;
  }
  if (loadType === "container40HC") {
    const candidates = new Set(["HC40", "40HC", "40HIGHCUBE"]);
    return type.transport_unit_types?.find((item) => candidates.has(normalize(item.short_name)) || candidates.has(normalize(item.name))) ?? null;
  }
  return null;
}

async function resolveLocation(query: string, mode: SupportedMode, key: string): Promise<{ id: number | string; type: LocationType; name: string; code: string } | null> {
  for (const locationType of preferredLocationTypes(mode)) {
    const params = new URLSearchParams({ search: query, location_type: locationType });
    const { response, payload } = await seaRatesFetch(`get/dictionary/locations?${params.toString()}`, key);
    if (!response.ok || !payload || typeof payload !== "object") continue;
    const data = (payload as Record<string, unknown>).data;
    if (!Array.isArray(data)) continue;
    const first = data.find((item): item is SeaRatesLocation => Boolean(item && typeof item === "object"));
    if (!first) continue;
    return {
      id: first.id,
      type: locationType,
      name: text(first.name) || query,
      code: text(first.short_name, 32),
    };
  }
  return null;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function marketPeriod() {
  const to = new Date();
  to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: dateOnly(from), to: dateOnly(to) };
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pruneEstimateCache() {
  const now = Date.now();
  for (const [key, item] of estimateCache) if (item.expiresAt <= now) estimateCache.delete(key);
  if (estimateCache.size <= 80) return;
  for (const key of estimateCache.keys()) {
    estimateCache.delete(key);
    if (estimateCache.size <= 60) break;
  }
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin market estimate requests are not accepted." }, 403);

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial estimate access is restricted." }, 403);

  const key = apiKey();
  if (!key) {
    return json({
      ok: false,
      configured: false,
      error: "SeaRates API is not configured yet. Add SEARATES_FREIGHT_INDEX_API_KEY to Firebase App Hosting secrets/environment variables.",
    }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The estimate request could not be read." }, 400);
  }

  const origin = text(body.origin);
  const destination = text(body.destination);
  const rawMode = text(body.mode, 12);
  const mode = rawMode as SupportedMode;
  const loadType = text(body.loadType, 24) as LoadType;
  const quantity = wholeNumber(body.quantity);
  const weight = positiveNumber(body.weight);
  const width = positiveNumber(body.width);
  const length = positiveNumber(body.length);
  const height = positiveNumber(body.height);

  if (origin.length < 2 || destination.length < 2) return json({ ok: false, error: "Enter both an origin and destination." }, 400);
  if (rawMode === "express") return json({ ok: false, error: "SeaRates Freight Index does not provide parcel/express benchmarks. Choose Air, FCL, LCL, FTL or LTL." }, 400);
  if (!supportedModes.includes(mode)) return json({ ok: false, error: "Choose Air, FCL, LCL, FTL or LTL for the SeaRates benchmark." }, 400);

  try {
    const [originResolved, destinationResolved, shippingTypes] = await Promise.all([
      resolveLocation(origin, mode, key),
      resolveLocation(destination, mode, key),
      getShippingTypes(key),
    ]);

    if (!originResolved) return json({ ok: false, error: `SeaRates could not resolve the origin “${origin}”. Select a SeaRates location from the dropdown.` }, 400);
    if (!destinationResolved) return json({ ok: false, error: `SeaRates could not resolve the destination “${destination}”. Select a SeaRates location from the dropdown.` }, 400);

    const shippingType = shippingTypeForMode(shippingTypes, mode);
    if (!shippingType) return json({ ok: false, error: `SeaRates did not return a ${mode.toUpperCase()} shipping type for this API plan.` }, 502);

    const transportUnit = transportUnitForLoad(shippingType, loadType);
    const period = marketPeriod();
    const calculateBody: Record<string, unknown> = {
      shipping_type: shippingType.id,
      carrier: null,
      origin_location_type: originResolved.type,
      origin_location_id: originResolved.id,
      destination_location_type: destinationResolved.type,
      destination_location_id: destinationResolved.id,
      date_from: period.from,
      date_to: period.to,
      group_by: "DAY",
    };
    if (transportUnit) calculateBody.transport_unit_type = transportUnit.id;

    const cacheKey = JSON.stringify(calculateBody);
    pruneEstimateCache();
    const cached = estimateCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return json(cached.value);

    const { response, payload } = await seaRatesFetch("post/calculate", key, {
      method: "POST",
      body: JSON.stringify(calculateBody),
    });

    if (!response.ok || !payload || typeof payload !== "object") {
      const status = response.status === 401 || response.status === 403 ? 502 : 502;
      return json({ ok: false, error: response.status === 401 || response.status === 403
        ? "SeaRates rejected the configured API key. Check the Firebase secret and SeaRates subscription."
        : "SeaRates could not calculate a freight market benchmark for this request." }, status);
    }

    const root = payload as Record<string, unknown>;
    const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : null;
    if (!root.success || !data) return json({ ok: false, error: "SeaRates returned no freight-index data for this lane and mode." }, 404);

    const stats = data.statistics && typeof data.statistics === "object" ? data.statistics as Record<string, unknown> : {};
    const min = numeric(stats.min);
    const max = numeric(stats.max);
    const average = numeric(stats.average);
    const latest = numeric(stats.last);
    const change = numeric(stats.change);
    const valid = data.is_valid !== false && [min, max, average, latest].some((value) => value !== null && value > 0);

    if (!valid || min === null || max === null) {
      return json({ ok: false, error: "SeaRates has no usable market index for this exact lane/mode in the selected 30-day period." }, 404);
    }

    const midpoint = average !== null && average > 0 ? average : (min + max) / 2;
    const fetchedAt = new Date().toISOString();
    const estimate = {
      provider: "SeaRates",
      source: "Freight Index API",
      mode,
      min,
      max,
      midpoint,
      latest: latest !== null && latest > 0 ? latest : midpoint,
      change,
      currency: "USD",
      period_from: text(data.date_from, 16) || period.from,
      period_to: text(data.date_to, 16) || period.to,
      fetched_at: fetchedAt,
      origin: text(data.origin) || originResolved.name,
      destination: text(data.destination) || destinationResolved.name,
      load_type: loadType,
      quantity,
      cargo_context: {
        weight,
        width,
        length,
        height,
        note: "Cargo measurements are retained as KCPL context; the SeaRates Freight Index is a lane-level market benchmark, not an exact shipment quote.",
      },
      disclaimer: "SeaRates Freight Index is market intelligence, not a binding carrier quotation. Verify KCPL partner buy rates, surcharges, routing and validity before quoting a customer.",
      attribution_url: "https://www.searates.com/freight-index/",
    };

    const value = { ok: true, configured: true, estimate };
    estimateCache.set(cacheKey, { expiresAt: Date.now() + ESTIMATE_TTL_MS, value });
    return json(value);
  } catch (error) {
    console.error("SeaRates market estimate failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "SeaRates market estimate failed." }, 502);
  }
}
