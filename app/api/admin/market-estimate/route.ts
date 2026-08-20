import { getAdminAccess } from "../../../admin/admin-auth";
import { quoteCurrencies, type QuoteCurrency } from "../../../admin/admin-data";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

const estimateModes = ["air", "LCL", "FCL", "LTL", "FTL", "express"] as const;
type EstimateMode = (typeof estimateModes)[number];

const loadTypes = ["boxes", "crate", "pallets", "container20", "container40", "container40HC"] as const;
type LoadType = (typeof loadTypes)[number];

type CachedEstimate = { expiresAt: number; value: unknown };
const estimateCache = new Map<string, CachedEstimate>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function text(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function wholeNumber(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 99 ? parsed : fallback;
}

function weightUnit(value: unknown) {
  const normalized = text(value, 12).toLowerCase();
  if (["kg", "kgs", "kilogram", "kilograms"].includes(normalized)) return "kg";
  if (["lb", "lbs", "pound", "pounds"].includes(normalized)) return "lb";
  if (["ton", "tons", "tonne", "tonnes", "mt"].includes(normalized)) return "ton";
  return "kg";
}

function dimensionUnit(value: unknown) {
  const normalized = text(value, 12).toLowerCase();
  if (["m", "meter", "metre", "meters", "metres"].includes(normalized)) return "m";
  if (["inch", "in", "inches"].includes(normalized)) return "inch";
  return "cm";
}

function moneyAmount(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const amount = Number(data.amount);
  const currency = text(data.currency, 8).toUpperCase();
  if (!Number.isFinite(amount) || amount < 0 || !currency) return null;
  return { amount, currency };
}

function numberText(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerErrorText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(providerErrorText).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(providerErrorText).filter(Boolean).join(" ");
  }
  return "";
}

function friendlyProviderError(raw: string) {
  if (/invalid url parameters/i.test(raw)) {
    return "The external provider could not understand these shipment details. Use a specific city and country (for example, Melbourne, Australia) and enter weight plus length, width and height for non-container cargo.";
  }
  if (/location|origin|destination|address|geocod/i.test(raw)) {
    return "The external provider could not resolve the route. Use a city and country, a three-letter airport code, or a five-letter UN seaport code.";
  }
  if (/dimension|width|length|height|volume|load/i.test(raw)) {
    return "The external provider needs complete cargo dimensions for this load type. Enter length, width and height for each box, crate or pallet.";
  }
  return raw || "No external market estimate was available for this route and load.";
}

function pruneCache() {
  const now = Date.now();
  for (const [key, cached] of estimateCache) if (cached.expiresAt <= now) estimateCache.delete(key);
  if (estimateCache.size <= 60) return;
  for (const key of estimateCache.keys()) {
    estimateCache.delete(key);
    if (estimateCache.size <= 50) break;
  }
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin estimate requests are not accepted." }, 403);

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial estimate access is restricted." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The estimate request could not be read." }, 400);
  }

  const origin = text(body.origin);
  const destination = text(body.destination);
  const mode = text(body.mode, 12) as EstimateMode;
  const loadType = text(body.loadType, 24) as LoadType;
  const currency = text(body.currency, 8).toUpperCase() as QuoteCurrency;
  const quantity = wholeNumber(body.quantity);
  const weight = positiveNumber(body.weight);
  const width = positiveNumber(body.width);
  const length = positiveNumber(body.length);
  const height = positiveNumber(body.height);
  const isContainer = loadType.startsWith("container");

  if (origin.length < 2 || destination.length < 2) return json({ ok: false, error: "Enter both an origin and destination." }, 400);
  if (!estimateModes.includes(mode)) return json({ ok: false, error: "Choose a supported freight mode." }, 400);
  if (!loadTypes.includes(loadType)) return json({ ok: false, error: "Choose a supported load type." }, 400);
  if (!quoteCurrencies.includes(currency)) return json({ ok: false, error: "Choose a supported estimate currency." }, 400);
  if (!isContainer && !weight) return json({ ok: false, error: "Enter a shipment weight for this estimate." }, 400);
  if (!isContainer && (!width || !length || !height)) {
    return json({ ok: false, error: "Enter length, width and height for each box, crate or pallet. Freightos requires dimensions (or volume) for non-container estimates." }, 400);
  }

  const params = new URLSearchParams({
    estimate: "true",
    format: "json",
    origin,
    destination,
    mode,
    loadtype: loadType,
    quantity: String(quantity),
    currency,
  });

  if (weight) params.set("weight", `${weight}${weightUnit(body.weightUnit)}`);
  const dimUnit = dimensionUnit(body.dimensionUnit);
  if (width) params.set("width", `${width}${dimUnit}`);
  if (length) params.set("length", `${length}${dimUnit}`);
  if (height) params.set("height", `${height}${dimUnit}`);

  const cacheKey = params.toString();
  pruneCache();
  const cached = estimateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  const upstreamUrl = `https://ship.freightos.com/api/shippingCalculator?${params.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "KCPL-Operations/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(18000),
    });
  } catch (error) {
    console.error("Freightos estimate request failed", error);
    return json({ ok: false, error: "The external freight estimate provider could not be reached." }, 502);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await upstream.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The external freight estimate provider returned an unreadable response." }, 502);
  }

  const response = payload.response && typeof payload.response === "object" ? payload.response as Record<string, unknown> : {};
  const rawProviderError = providerErrorText(response.errors || payload.errors);

  if (!upstream.ok) {
    console.error("Freightos estimate returned HTTP error", upstream.status, payload);
    return json({ ok: false, error: friendlyProviderError(rawProviderError) }, 502);
  }

  const rates = response.estimatedFreightRates && typeof response.estimatedFreightRates === "object"
    ? response.estimatedFreightRates as Record<string, unknown>
    : null;

  const rawMode = rates?.mode;
  const modeRows = Array.isArray(rawMode)
    ? rawMode.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : rawMode && typeof rawMode === "object" ? [rawMode as Record<string, unknown>] : [];
  const selected = modeRows.find((row) => text(row.mode, 12).toLowerCase() === mode.toLowerCase()) ?? modeRows[0];

  if (!rates || !selected) {
    return json({ ok: false, error: friendlyProviderError(rawProviderError) }, 404);
  }

  const price = selected.price && typeof selected.price === "object" ? selected.price as Record<string, unknown> : {};
  const min = moneyAmount((price.min as Record<string, unknown> | undefined)?.moneyAmount);
  const max = moneyAmount((price.max as Record<string, unknown> | undefined)?.moneyAmount);
  if (!min || !max || min.currency !== max.currency) return json({ ok: false, error: "The provider returned an incomplete price range." }, 502);

  const transit = selected.transitTimes && typeof selected.transitTimes === "object" ? selected.transitTimes as Record<string, unknown> : {};
  const transitMin = numberText(transit.min);
  const transitMax = numberText(transit.max);
  const transitUnit = text(transit.unit, 24) || "days";
  const midpoint = (min.amount + max.amount) / 2;
  const fetchedAt = new Date().toISOString();

  const value = {
    ok: true,
    estimate: {
      provider: "Freightos Marketplace",
      source: "Public Shipping Estimates API",
      mode: text(selected.mode, 12) || mode,
      min: min.amount,
      max: max.amount,
      midpoint,
      currency: min.currency,
      transit_min: transitMin,
      transit_max: transitMax,
      transit_unit: transitUnit,
      num_quotes: numberText(rates.numQuotes),
      fetched_at: fetchedAt,
      origin,
      destination,
      load_type: loadType,
      quantity,
      disclaimer: "External marketplace estimate only. Verify carrier, partner, surcharges and KCPL buy rate before issuing a customer quotation.",
      attribution_url: "https://ship.freightos.com",
    },
  };

  estimateCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return json(value);
}
