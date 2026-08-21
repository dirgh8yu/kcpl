const GOOGLE_ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

export type GoogleRoadRouteInput = {
  origin: string;
  destination: string;
  waypoints?: string[];
  trafficAware?: boolean;
};

export type GoogleRoadRouteEstimate = {
  provider: "Google Maps Routes API";
  origin: string;
  destination: string;
  waypoints: string[];
  distance_meters: number;
  distance_km: number;
  duration_seconds: number;
  static_duration_seconds: number;
  traffic_delay_seconds: number;
  estimated_arrival_at: string;
  traffic_aware: boolean;
  route_description: string | null;
  warnings: string[];
  requested_at: string;
};

type GoogleRoute = {
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  description?: string;
  warnings?: string[];
};

type GoogleRoutesResponse = {
  routes?: GoogleRoute[];
  error?: { code?: number; message?: string; status?: string };
};

export class GoogleRoutesConfigurationError extends Error {
  constructor() {
    super("Google Maps Routes API is not configured for this deployment.");
    this.name = "GoogleRoutesConfigurationError";
  }
}

function cleanLocation(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function secondsFromDuration(value: string | undefined) {
  if (!value || !value.endsWith("s")) return null;
  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function validateInput(input: GoogleRoadRouteInput) {
  const origin = cleanLocation(input.origin);
  const destination = cleanLocation(input.destination);
  const waypoints = (input.waypoints ?? []).map(cleanLocation).filter(Boolean);

  if (origin.length < 2 || origin.length > 220) throw new Error("Enter a valid road-route origin.");
  if (destination.length < 2 || destination.length > 220) throw new Error("Enter a valid road-route destination.");
  if (waypoints.length > 8) throw new Error("Use no more than 8 intermediate road stops in one estimate.");
  if (waypoints.some((item) => item.length > 220)) throw new Error("One or more intermediate road stops are too long.");

  return { origin, destination, waypoints, trafficAware: input.trafficAware === true };
}

export async function computeGoogleRoadRoute(input: GoogleRoadRouteInput): Promise<GoogleRoadRouteEstimate> {
  const apiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim();
  if (!apiKey) throw new GoogleRoutesConfigurationError();

  const request = validateInput(input);
  const body = {
    origin: { address: request.origin },
    destination: { address: request.destination },
    intermediates: request.waypoints.map((address) => ({ address })),
    travelMode: "DRIVE",
    routingPreference: request.trafficAware ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
    computeAlternativeRoutes: false,
    languageCode: "en",
    units: "METRIC",
  };

  const response = await fetch(GOOGLE_ROUTES_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": "routes.distanceMeters,routes.duration,routes.staticDuration,routes.description,routes.warnings",
    },
    body: JSON.stringify(body),
  });

  let payload: GoogleRoutesResponse;
  try {
    payload = await response.json() as GoogleRoutesResponse;
  } catch {
    throw new Error(`Google Routes returned HTTP ${response.status} with a non-JSON response.`);
  }

  if (!response.ok) {
    const detail = payload.error?.message?.trim();
    throw new Error(detail || `Google Routes returned HTTP ${response.status}.`);
  }

  const route = payload.routes?.[0];
  if (!route) throw new Error("Google Routes could not find a drivable route for these locations.");

  const distanceMeters = typeof route.distanceMeters === "number" && Number.isFinite(route.distanceMeters)
    ? route.distanceMeters
    : null;
  const durationSeconds = secondsFromDuration(route.duration);
  const staticDurationSeconds = secondsFromDuration(route.staticDuration) ?? durationSeconds;

  if (distanceMeters === null || durationSeconds === null || staticDurationSeconds === null) {
    throw new Error("Google Routes returned an incomplete route estimate.");
  }

  const requestedAt = new Date();
  return {
    provider: "Google Maps Routes API",
    origin: request.origin,
    destination: request.destination,
    waypoints: request.waypoints,
    distance_meters: Math.round(distanceMeters),
    distance_km: Math.round((distanceMeters / 1000) * 10) / 10,
    duration_seconds: Math.round(durationSeconds),
    static_duration_seconds: Math.round(staticDurationSeconds),
    traffic_delay_seconds: Math.max(0, Math.round(durationSeconds - staticDurationSeconds)),
    estimated_arrival_at: new Date(requestedAt.getTime() + durationSeconds * 1000).toISOString(),
    traffic_aware: request.trafficAware,
    route_description: route.description?.trim() || null,
    warnings: Array.isArray(route.warnings) ? route.warnings.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [],
    requested_at: requestedAt.toISOString(),
  };
}
