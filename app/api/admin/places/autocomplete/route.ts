import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { autocompleteGooglePlaces, GooglePlacesConfigurationError } from "../../../../integrations/google-places.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
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
    return json({ ok: false, error: "Invalid place search request." }, 400);
  }

  const input = typeof body.input === "string" ? body.input : "";
  if (input.trim().length < 3) return json({ ok: true, suggestions: [] });
  if (input.length > 180) return json({ ok: false, error: "Location search is too long." }, 400);

  try {
    const suggestions = await autocompleteGooglePlaces(input);
    return json({ ok: true, suggestions });
  } catch (error) {
    if (error instanceof GooglePlacesConfigurationError) {
      return json({
        ok: false,
        needs_configuration: true,
        error: "Google Places is not configured for this deployment.",
      }, 503);
    }

    console.error("Google Places autocomplete failed", error);
    return json({ ok: false, error: "Place suggestions are temporarily unavailable." }, 502);
  }
}
