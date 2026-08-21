import { getAdminAccess } from "../../../admin/admin-auth";
import { crmCurrencies, type CrmCurrency } from "../../../admin/crm/crm-data";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { tmsTenderChannels, type TmsTenderChannel } from "../../../admin/tenders/tms-tendering";
import {
  cancelTmsTender,
  confirmTmsTenderBooking,
  createTmsTender,
  listTmsTenders,
  respondToTmsTender,
} from "../../../admin/tenders/tms-tendering.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

async function auth() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return { response: json({ ok: false, error: "Commercial access is required." }, 403) };
  return { user: access.user, staff };
}

export async function GET() {
  const access = await auth();
  if ("response" in access) return access.response;
  const result = await listTmsTenders(access.staff);
  if (result.kind !== "ready") return json({ ok: false, error: "Tender storage is unavailable." }, 503);
  return json({ ok: true, tenders: result.tenders, canManageTenders: access.staff.permissions.canEditCommercial });
}

export async function POST(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin tender updates are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = clean(body.action, 40);
  const actor = { name: access.user.displayName, email: access.user.email };

  if (action === "create") {
    const channel = clean(body.channel, 20) as TmsTenderChannel;
    if (!tmsTenderChannels.includes(channel)) return json({ ok: false, error: "Choose a valid tender channel." }, 400);
    const result = await createTmsTender({
      orderId: clean(body.orderId, 120),
      channel,
      recipientName: clean(body.recipientName, 160),
      recipientEmail: clean(body.recipientEmail, 240),
      responseDueAt: clean(body.responseDueAt, 80),
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Tender storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "You do not have access to tender this order." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "rate_required") return json({ ok: false, error: "Select a valid Partner buy rate before tendering." }, 409);
    if (result.kind === "active_tender") return json({ ok: false, error: "This order already has an active tender. Resolve, cancel or expire it before re-tendering." }, 409);
    if (result.kind === "rate_unavailable") return json({ ok: false, error: "The selected procurement rate is no longer available." }, 409);
    if (result.kind === "recipient_required") return json({ ok: false, error: "A valid recipient email is required for an email tender." }, 400);
    if (result.kind === "invalid_deadline") return json({ ok: false, error: "Tender response deadline must be in the future." }, 400);
    if (result.kind !== "created") return json({ ok: false, error: "The tender could not be created." }, 400);
    return json({ ok: true, tender: result.tender }, 201);
  }

  if (action === "respond") {
    const status = clean(body.status, 20);
    if (!["accepted", "rejected", "countered"].includes(status)) return json({ ok: false, error: "Choose accepted, rejected or countered." }, 400);
    const counterCurrencyRaw = clean(body.counterCurrency, 10).toUpperCase();
    const counterCurrency = counterCurrencyRaw ? counterCurrencyRaw as CrmCurrency : null;
    if (counterCurrency && !crmCurrencies.includes(counterCurrency)) return json({ ok: false, error: "Choose a supported counter-offer currency." }, 400);
    const result = await respondToTmsTender(clean(body.tenderId, 120), {
      status: status as "accepted" | "rejected" | "countered",
      note: clean(body.note, 4000),
      counterCost: optionalNumber(body.counterCost),
      counterCurrency,
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Tender storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This tender is outside your access." }, 403);
    if (result.kind === "missing" || result.kind === "missing_order") return json({ ok: false, error: "Tender or transport order not found." }, 404);
    if (result.kind === "expired") return json({ ok: false, error: "This tender has expired. Select a rate and re-tender the order." }, 409);
    if (result.kind === "invalid_counter") return json({ ok: false, error: "A counter-offer requires a valid amount and currency." }, 400);
    if (result.kind === "invalid_transition") return json({ ok: false, error: "That tender response is not allowed from the current state." }, 409);
    if (result.kind !== "updated") return json({ ok: false, error: "The tender response could not be recorded." }, 400);
    return json({ ok: true, tender: result.tender });
  }

  if (action === "cancel") {
    const result = await cancelTmsTender(clean(body.tenderId, 120), clean(body.note, 4000), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Tender storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This tender is outside your access." }, 403);
    if (result.kind === "missing" || result.kind === "missing_order") return json({ ok: false, error: "Tender or transport order not found." }, 404);
    if (result.kind === "invalid_transition") return json({ ok: false, error: "This tender can no longer be cancelled." }, 409);
    return json({ ok: true });
  }

  if (action === "book") {
    const result = await confirmTmsTenderBooking(clean(body.tenderId, 120), {
      bookingReference: clean(body.bookingReference, 200),
      pickupConfirmation: clean(body.pickupConfirmation, 1000),
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Booking storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This tender is outside your access." }, 403);
    if (result.kind === "missing" || result.kind === "missing_order") return json({ ok: false, error: "Tender or transport order not found." }, 404);
    if (result.kind === "invalid_transition") return json({ ok: false, error: "Only an accepted tender or recorded counter-offer can be booked." }, 409);
    if (result.kind === "commercials_required") return json({ ok: false, error: "Final tender commercials are incomplete." }, 409);
    if (result.kind === "customer_required") return json({ ok: false, error: "Link the transport order to a KCPL customer before confirming a booking." }, 409);
    if (result.kind === "customer_missing") return json({ ok: false, error: "The linked customer could not be found." }, 409);
    if (result.kind === "booking_reference_required") return json({ ok: false, error: "Carrier / partner booking reference is required." }, 400);
    if (result.kind !== "booked") return json({ ok: false, error: "The booking could not be confirmed." }, 400);
    return json({ ok: true, shipmentReference: result.shipmentReference });
  }

  return json({ ok: false, error: "Unknown tender action." }, 400);
}
