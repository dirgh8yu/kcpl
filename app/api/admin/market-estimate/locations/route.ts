import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";

const LOCATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
type CachedLocations = { expiresAt: number; value: LocationSuggestion[] };
type LocationSuggestion = { value: string; label: string; kind: string; detail: string };
const locationCache = new Map<string, CachedLocations>();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function pruneCache() {
  const now = Date.now();
  for (const [key, item] of locationCache) if (item.expiresAt <= now) locationCache.delete(key);
  if (locationCache.size <= 250) return;
  for (const key of locationCache.keys()) {
    locationCache.delete(key);
    if (locationCache.size <= 200) break;
  }
}

function suggestionFromFeature(feature: unknown): LocationSuggestion | null {
  if (!feature || typeof feature !== "object") return null;
  const properties = (feature as Record<string, unknown>).properties;
  if (!properties || typeof properties !== "object") return null;
  const data = properties as Record<string, unknown>;

  const name = clean(data.name);
  const city = clean(data.city) || clean(data.locality) || clean(data.district);
  const state = clean(data.state);
  const country = clean(data.country);
  const postcode = clean(data.postcode, 32);
  const street = clean(data.street);
  const houseNumber = clean(data.housenumber, 24);
  const type = clean(data.type, 32).toLowerCase();

  const primary = name || city;
  if (!primary || !country) return null;

  const addressPrimary = type === "house" && street
    ? [houseNumber, street].filter(Boolean).join(" ")
    : primary;
  const valueParts = [addressPrimary];
  if (city && city.toLowerCase() !== addressPrimary.toLowerCase()) valueParts.push(city);
  if (state && !valueParts.some((part) => part.toLowerCase() === state.toLowerCase())) valueParts.push(state);
  valueParts.push(country);
  const value = valueParts.filter(Boolean).join(", ");

  const kind = type === "city" ? "City"
    : type === "locality" ? "Locality"
      : type === "district" ? "District"
        : type === "street" || type === "house" ? "Address"
          : "Location";

  const detailParts = [state, country, postcode].filter(Boolean);
  return {
    value,
    label: value,
    kind,
    detail: detailParts.join(" · "),
  };
}

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial estimate access is restricted." }, 403);

  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q"), 120);
  if (query.length < 2) return json({ ok: true, suggestions: [] });

  const cacheKey = query.toLowerCase();
  pruneCache();
  const cached = locationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json({ ok: true, suggestions: cached.value });

  const params = new URLSearchParams({ q: query, limit: "10", lang: "en" });
  params.append("layer", "city");
  params.append("layer", "locality");
  params.append("layer", "district");
  params.append("layer", "street");
  params.append("layer", "house");

  let upstream: Response;
  try {
    upstream = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { accept: "application/json", "user-agent": "KCPL-Operations/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch (error) {
    console.error("KCPL location autocomplete request failed", error);
    return json({ ok: false, error: "Location suggestions are temporarily unavailable." }, 502);
  }

  if (!upstream.ok) return json({ ok: false, error: "Location suggestions are temporarily unavailable." }, 502);

  let payload: Record<string, unknown>;
  try {
    payload = await upstream.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Location suggestions returned an unreadable response." }, 502);
  }

  const features = Array.isArray(payload.features) ? payload.features : [];
  const seen = new Set<string>();
  const suggestions: LocationSuggestion[] = [];
  for (const feature of features) {
    const suggestion = suggestionFromFeature(feature);
    if (!suggestion) continue;
    const key = suggestion.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= 8) break;
  }

  locationCache.set(cacheKey, { expiresAt: Date.now() + LOCATION_CACHE_TTL_MS, value: suggestions });
  return json({ ok: true, suggestions, source: "OpenStreetMap via Photon" });
}
