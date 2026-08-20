import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../admin/staff-directory.server";

const SEARATES_BASE = "https://rates.searates.com/api/v1/freight-index";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type LocationType = "CITY" | "PORT" | "AIRPORT";
type CachedSuggestions = { expiresAt: number; value: LocationSuggestion[] };
type LocationSuggestion = {
  value: string;
  label: string;
  kind: string;
  detail: string;
  providerId: string;
  locationType: LocationType;
  shortName: string;
};

type SeaRatesLocation = {
  id?: string | number;
  name?: string;
  short_name?: string;
  country?: string;
  latitude?: string | number;
  longitude?: string | number;
};

const cache = new Map<string, CachedSuggestions>();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function apiKey() {
  return clean(process.env.SEARATES_FREIGHT_INDEX_API_KEY, 512);
}

function allowedTypes(mode: string): LocationType[] {
  if (mode === "air") return ["AIRPORT", "CITY"];
  if (mode === "FCL" || mode === "LCL") return ["PORT", "CITY"];
  return ["CITY"];
}

function pruneCache() {
  const now = Date.now();
  for (const [key, item] of cache) if (item.expiresAt <= now) cache.delete(key);
  if (cache.size <= 250) return;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (cache.size <= 200) break;
  }
}

async function findByType(query: string, locationType: LocationType, key: string) {
  const params = new URLSearchParams({ search: query, location_type: locationType });
  const response = await fetch(`${SEARATES_BASE}/get/dictionary/locations?${params.toString()}`, {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-API-KEY": key,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("SeaRates rejected the configured API key.");
    return [];
  }

  const rows = Array.isArray(payload.data)
    ? payload.data.filter((item): item is SeaRatesLocation => Boolean(item && typeof item === "object"))
    : [];

  return rows.map((row): LocationSuggestion | null => {
    const providerId = row.id === undefined || row.id === null ? "" : String(row.id);
    const name = clean(row.name);
    if (!providerId || !name) return null;
    const shortName = clean(row.short_name, 32);
    const country = clean(row.country, 8);
    const kind = locationType === "AIRPORT" ? "Airport" : locationType === "PORT" ? "Port" : "City";
    return {
      value: name,
      label: shortName ? `${name} · ${shortName}` : name,
      kind,
      detail: [country, shortName].filter(Boolean).join(" · "),
      providerId,
      locationType,
      shortName,
    };
  }).filter((item): item is LocationSuggestion => Boolean(item));
}

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial estimate access is restricted." }, 403);

  const key = apiKey();
  if (!key) {
    return json({
      ok: false,
      configured: false,
      suggestions: [],
      error: "SeaRates API key is not configured yet.",
    }, 503);
  }

  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q"), 120);
  const mode = clean(url.searchParams.get("mode"), 12) || "air";
  if (query.length < 2) return json({ ok: true, configured: true, suggestions: [] });

  const cacheKey = `${mode}:${query.toLowerCase()}`;
  pruneCache();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json({ ok: true, configured: true, suggestions: cached.value });

  try {
    const resultSets = await Promise.all(allowedTypes(mode).map((type) => findByType(query, type, key)));
    const seen = new Set<string>();
    const suggestions: LocationSuggestion[] = [];

    for (const rows of resultSets) {
      for (const row of rows) {
        const dedupeKey = `${row.locationType}:${row.providerId}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        suggestions.push(row);
        if (suggestions.length >= 10) break;
      }
      if (suggestions.length >= 10) break;
    }

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: suggestions });
    return json({ ok: true, configured: true, suggestions, source: "SeaRates Freight Index location dictionary" });
  } catch (error) {
    console.error("SeaRates location autocomplete failed", error);
    return json({
      ok: false,
      configured: true,
      suggestions: [],
      error: error instanceof Error ? error.message : "SeaRates location suggestions are temporarily unavailable.",
    }, 502);
  }
}
