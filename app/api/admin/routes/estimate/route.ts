import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { computeGoogleRoadRoute, GoogleRoutesConfigurationError } from "../../../../integrations/google-routes.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial access is required." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid route request." }, 400);
  }

  const waypoints = Array.isArray(body.waypoints)
    ? body.waypoints.filter((item): item is string => typeof item === "string")
    : [];

  try {
    const estimate = await computeGoogleRoadRoute({
      origin: text(body.origin),
      destination: text(body.destination),
      waypoints,
      trafficAware: body.trafficAware === true,
    });

    return json({
      ok: true,
      estimate,
      pricing_note: estimate.traffic_aware
        ? "Traffic-aware routing uses a Google Routes Pro request."
        : "Standard road routing uses a Google Routes Essentials request.",
      disclaimer: "Driving time is a routing estimate, not a guaranteed cargo ETA. Border, customs, truck restrictions, road closures and mandatory rest time can materially change transit time.",
    });
  } catch (error) {
    if (error instanceof GoogleRoutesConfigurationError) {
      return json({
        ok: false,
        needs_configuration: true,
        error: "Google Routes is ready in KCPL but the GOOGLE_MAPS_ROUTES_API_KEY secret has not been configured in Firebase App Hosting.",
      }, 503);
    }

    console.error("Google road route estimate failed", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Google road route estimate is temporarily unavailable.",
    }, 502);
  }
}
