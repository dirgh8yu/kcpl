import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

const RATE_CACHE_TTL_MS = 10 * 60 * 1000;
const rateCache = new Map<string, { expiresAt: number; value: unknown }>();

type AddressInput = {
  label?: unknown;
  line1?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  countryCode?: unknown;
};

type RateRow = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function wholeNumber(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 50 ? parsed : fallback;
}

function easyshipToken() {
  return clean(process.env.EASYSHIP_API_TOKEN, 1024);
}

function apiBase(token: string) {
  return token.startsWith("sand_")
    ? "https://public-api-sandbox.easyship.com/2024-09"
    : "https://public-api.easyship.com/2024-09";
}

function normalizeAddress(input: AddressInput | undefined) {
  const city = clean(input?.city, 200);
  const state = clean(input?.state, 200);
  const postalCode = clean(input?.postalCode, 24);
  const countryCode = clean(input?.countryCode, 2).toUpperCase();
  const line1 = clean(input?.line1, 35) || city.slice(0, 35);
  const label = clean(input?.label, 200) || [city, state, countryCode].filter(Boolean).join(", ");
  if (!city || !countryCode || !postalCode || !line1) return null;
  return {
    label,
    api: {
      line_1: line1,
      city,
      state: state || null,
      postal_code: postalCode,
      country_alpha2: countryCode,
    },
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown, max = 200) {
  return clean(value, max);
}

function extractRates(payload: unknown): RateRow[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const direct = root.rates;
  if (Array.isArray(direct)) return direct.filter((row): row is RateRow => Boolean(row && typeof row === "object"));
  const data = root.data;
  if (data && typeof data === "object") {
    const rates = (data as Record<string, unknown>).rates;
    if (Array.isArray(rates)) return rates.filter((row): row is RateRow => Boolean(row && typeof row === "object"));
  }
  return [];
}

function extractError(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const candidates = [root.message, root.error, root.errors, root.detail, root.details];
  const walk = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(walk).filter(Boolean).join(" ");
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(walk).filter(Boolean).join(" ");
    return "";
  };
  return candidates.map(walk).filter(Boolean).join(" ").slice(0, 700);
}

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of rateCache) if (value.expiresAt <= now) rateCache.delete(key);
  if (rateCache.size <= 60) return;
  for (const key of rateCache.keys()) {
    rateCache.delete(key);
    if (rateCache.size <= 45) break;
  }
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin rate requests are not accepted." }, 403);

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial rate access is restricted." }, 403);

  const token = easyshipToken();
  if (!token) {
    return json({
      ok: false,
      configured: false,
      error: "Easyship is not configured yet. Add EASYSHIP_API_TOKEN to Firebase App Hosting. Use a sand_ token for test rates or a prod_ token for live courier rates.",
    }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The rate request could not be read." }, 400);
  }

  const origin = normalizeAddress(body.origin as AddressInput | undefined);
  const destination = normalizeAddress(body.destination as AddressInput | undefined);
  if (!origin || !destination) return json({ ok: false, error: "Choose valid origin and destination locations and enter both postal codes." }, 400);

  const quantity = wholeNumber(body.quantity);
  const weight = positiveNumber(body.weight);
  const length = positiveNumber(body.length);
  const width = positiveNumber(body.width);
  const height = positiveNumber(body.height);
  if (!weight || !length || !width || !height) return json({ ok: false, error: "Enter weight, length, width and height for each parcel." }, 400);

  const totalWeight = weight * quantity;
  const declaredCurrency = clean(body.currency, 3).toUpperCase() || "USD";
  const declaredValue = positiveNumber(body.declaredValue) ?? 1;

  const upstreamBody = {
    origin_address: origin.api,
    destination_address: destination.api,
    incoterms: "DDU",
    insurance: { is_insured: false },
    courier_settings: {
      show_courier_logo_url: true,
      apply_shipping_rules: true,
    },
    shipping_settings: {
      units: { weight: "kg", dimensions: "cm" },
    },
    parcels: Array.from({ length: quantity }, () => ({
      total_actual_weight: weight,
      box: {
        length,
        width,
        height,
      },
      items: [{
        description: "General cargo",
        category: "others",
        quantity: 1,
        actual_weight: weight,
        declared_currency: declaredCurrency,
        declared_customs_value: declaredValue,
        origin_country_alpha2: origin.api.country_alpha2,
      }],
    })),
    calculate_tax_and_duties: false,
  };

  const cacheKey = JSON.stringify(upstreamBody);
  pruneCache();
  const cached = rateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);

  let upstream: Response;
  let payload: unknown;
  try {
    upstream = await fetch(`${apiBase(token)}/rates`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "KCPL-Operations/1.0",
      },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    try {
      payload = await upstream.json();
    } catch {
      payload = null;
    }
  } catch (error) {
    console.error("Easyship rates request failed", error);
    return json({ ok: false, error: "Easyship could not be reached." }, 502);
  }

  if (!upstream.ok) {
    const detail = extractError(payload);
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ ok: false, error: "Easyship rejected the configured token. Check the API token and ensure public.rate:read is enabled." }, 502);
    }
    if (upstream.status === 402) {
      return json({ ok: false, error: "Easyship Rates API access is not enabled for this account or the API usage allowance is unavailable." }, 402);
    }
    if (upstream.status === 422) {
      return json({ ok: false, error: detail || "Easyship could not rate this shipment. Check the addresses, postal codes and parcel measurements." }, 422);
    }
    return json({ ok: false, error: detail || `Easyship returned HTTP ${upstream.status}.` }, 502);
  }

  const rawRates = extractRates(payload);
  const rates = rawRates.map((row) => {
    const total = numberValue(row.total_charge) ?? numberValue(row.shipment_charge_total) ?? numberValue(row.shipment_charge);
    return {
      courier_service_id: textValue(row.courier_service_id ?? row.courier_id, 120),
      courier_name: textValue(row.courier_name ?? row.courier_service_name ?? row.name, 180) || "Courier service",
      courier_logo_url: textValue(row.courier_logo_url ?? row.logo_url, 500),
      currency: textValue(row.currency, 8).toUpperCase() || declaredCurrency,
      total_charge: total,
      shipment_charge: numberValue(row.shipment_charge),
      shipment_charge_total: numberValue(row.shipment_charge_total),
      min_delivery_time: numberValue(row.min_delivery_time),
      max_delivery_time: numberValue(row.max_delivery_time),
      cost_rank: numberValue(row.cost_rank),
      delivery_time_rank: numberValue(row.delivery_time_rank),
      value_for_money_rank: numberValue(row.value_for_money_rank),
      easyship_rating: numberValue(row.easyship_rating),
      tracking_rating: numberValue(row.tracking_rating),
      description: textValue(row.description ?? row.full_description ?? row.courier_remarks, 320),
    };
  }).filter((rate) => rate.total_charge !== null && rate.total_charge >= 0)
    .sort((a, b) => (a.total_charge ?? Number.POSITIVE_INFINITY) - (b.total_charge ?? Number.POSITIVE_INFINITY));

  if (!rates.length) return json({ ok: false, error: "Easyship returned no courier rates for this route and parcel." }, 404);

  const value = {
    ok: true,
    configured: true,
    environment: token.startsWith("sand_") ? "sandbox" : "production",
    fetched_at: new Date().toISOString(),
    origin: origin.label,
    destination: destination.label,
    quantity,
    total_weight_kg: totalWeight,
    rates: rates.slice(0, 12),
    disclaimer: token.startsWith("sand_")
      ? "Easyship sandbox rates are illustrative only. Switch to a prod_ token for real courier prices."
      : "Live Easyship courier rates are external references. Confirm service availability and KCPL commercial terms before quoting the customer.",
  };

  rateCache.set(cacheKey, { expiresAt: Date.now() + RATE_CACHE_TTL_MS, value });
  return json(value);
}
