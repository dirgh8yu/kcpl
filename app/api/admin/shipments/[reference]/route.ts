import { getAdminAccess } from "../../../../admin/admin-auth";
import { addShipmentEvent, updateShipment } from "../../../../shipment-data.server";
import { shipmentStatuses, type ShipmentStatus } from "../../../../shipment-types";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") return { user: access.user };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The shipment update could not be read." }, 400);
  }

  const status = clean(body.status);
  const eta = clean(body.eta);
  const currentLocation = clean(body.currentLocation);
  const carrier = clean(body.carrier);
  const carrierReference = clean(body.carrierReference);
  const customerNote = clean(body.customerNote);

  if (!shipmentStatuses.includes(status as ShipmentStatus)) return json({ ok: false, error: "Choose a valid shipment status." }, 400);
  if (eta && !/^\d{4}-\d{2}-\d{2}$/.test(eta)) return json({ ok: false, error: "Choose a valid ETA date." }, 400);
  if (currentLocation.length > 180) return json({ ok: false, error: "Current location must be 180 characters or fewer." }, 400);
  if (carrier.length > 160) return json({ ok: false, error: "Carrier must be 160 characters or fewer." }, 400);
  if (carrierReference.length > 160) return json({ ok: false, error: "Carrier reference must be 160 characters or fewer." }, 400);
  if (customerNote.length > 2000) return json({ ok: false, error: "Customer update must be 2000 characters or fewer." }, 400);

  const result = await updateShipment(reference, {
    status: status as ShipmentStatus,
    eta,
    currentLocation,
    carrier,
    carrierReference,
    customerNote,
  }, auth.user.displayName);

  if (result.kind === "unavailable") return json({ ok: false, error: "Shipment storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  return json({ ok: true, shipment: result.shipment });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The tracking event could not be read." }, 400);
  }

  const title = clean(body.title);
  const location = clean(body.location);
  const details = clean(body.details);
  const eventTime = clean(body.eventTime);

  if (!title) return json({ ok: false, error: "Add an event title." }, 400);
  if (title.length > 180) return json({ ok: false, error: "Event title must be 180 characters or fewer." }, 400);
  if (location.length > 180) return json({ ok: false, error: "Event location must be 180 characters or fewer." }, 400);
  if (details.length > 2000) return json({ ok: false, error: "Event details must be 2000 characters or fewer." }, 400);
  if (eventTime && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(eventTime)) {
    return json({ ok: false, error: "Choose a valid event date and time." }, 400);
  }

  const result = await addShipmentEvent(reference, { title, location, details, eventTime }, auth.user.displayName);
  if (result.kind === "unavailable") return json({ ok: false, error: "Shipment storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  return json({ ok: true, event: result.event }, 201);
}
