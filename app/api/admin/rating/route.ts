import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../../../admin/crm/crm-data";
import { tmsModes, tmsRateUnits, type TmsMode, type TmsRateUnit } from "../../../admin/rating/tms-rating";
import {
  createPartnerBuyRateCard,
  createTmsOrder,
  listPartnerBuyRateCards,
  listTmsOrders,
  rateTmsOrder,
  selectTmsRate,
} from "../../../admin/rating/tms-rating.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clean(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function num(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function optionalNum(value: unknown) { if (value === null || value === undefined || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; }

async function auth() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return { response: json({ ok: false, error: "Commercial access is required." }, 403) };
  return { user: access.user, staff };
}

export async function GET(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  const url = new URL(request.url);
  const orderId = clean(url.searchParams.get("order"), 120);
  if (orderId) {
    const result = await rateTmsOrder(orderId, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Rating storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This order is outside your branch access." }, 403);
    if (result.kind !== "ready") return json({ ok: false, error: "This order cannot be rated." }, 400);
    return json({ ok: true, order: result.order, results: result.results });
  }
  const [orders, rates] = await Promise.all([listTmsOrders(access.staff), listPartnerBuyRateCards(access.staff)]);
  if (orders.kind !== "ready" || rates.kind !== "ready") return json({ ok: false, error: "Rating storage is unavailable." }, 503);
  return json({ ok: true, orders: orders.orders, rateCards: rates.rateCards, canManageRateCards: access.staff.permissions.canManageRateCards });
}

export async function POST(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin rating updates are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = clean(body.action, 40);
  const actor = { name: access.user.displayName, email: access.user.email };

  if (action === "create_order") {
    const branch = clean(body.branch, 80) as KcplBranch;
    const mode = clean(body.mode, 30) as TmsMode;
    if (!kcplBranches.includes(branch) || !tmsModes.includes(mode)) return json({ ok: false, error: "Choose a valid branch and transport mode." }, 400);
    const result = await createTmsOrder({
      branch,
      customerId: clean(body.customerId, 120),
      customerName: clean(body.customerName, 200),
      origin: clean(body.origin, 240),
      destination: clean(body.destination, 240),
      mode,
      pickupDate: clean(body.pickupDate, 20),
      deliveryDate: clean(body.deliveryDate, 20),
      weightKg: num(body.weightKg),
      volumeCbm: num(body.volumeCbm),
      pieces: num(body.pieces),
      containerCount: num(body.containerCount),
      equipment: clean(body.equipment, 160),
      temperatureRequirement: clean(body.temperatureRequirement, 160),
      carrierRequirement: clean(body.carrierRequirement, 200),
      notes: clean(body.notes, 5000),
    }, actor, access.staff);
    if (result.kind === "forbidden") return json({ ok: false, error: "This branch is outside your staff access." }, 403);
    if (result.kind === "unavailable") return json({ ok: false, error: "Order storage is unavailable." }, 503);
    if (result.kind !== "created") return json({ ok: false, error: "Enter a valid order with origin, destination and non-negative cargo quantities." }, 400);
    return json({ ok: true, order: result.order }, 201);
  }

  if (action === "create_rate") {
    if (!access.staff.permissions.canManageRateCards) return json({ ok: false, error: "Rate-card management access is required." }, 403);
    const mode = clean(body.mode, 30) as TmsMode;
    const unit = clean(body.unit, 30) as TmsRateUnit;
    const currency = clean(body.currency, 10).toUpperCase() as CrmCurrency;
    const branchRaw = clean(body.branch, 80);
    const branch = branchRaw === "Global" ? "Global" : branchRaw as KcplBranch;
    if (!tmsModes.includes(mode) || !tmsRateUnits.includes(unit) || !crmCurrencies.includes(currency) || (branch !== "Global" && !kcplBranches.includes(branch))) return json({ ok: false, error: "Choose valid rate-card dimensions." }, 400);
    const result = await createPartnerBuyRateCard({
      partnerId: clean(body.partnerId, 120), branch, origin: clean(body.origin, 240), destination: clean(body.destination, 240), mode,
      service: clean(body.service, 160), equipment: clean(body.equipment, 160), currency, rate: num(body.rate), unit,
      minimumCharge: optionalNum(body.minimumCharge), fuelSurchargePercent: num(body.fuelSurchargePercent), accessorialFlat: num(body.accessorialFlat),
      transitDaysMin: optionalNum(body.transitDaysMin), transitDaysMax: optionalNum(body.transitDaysMax), validFrom: clean(body.validFrom, 20), validUntil: clean(body.validUntil, 20),
      notes: clean(body.notes, 5000), active: body.active !== false,
    }, actor, access.staff);
    if (result.kind === "missing_partner") return json({ ok: false, error: "Choose an active KCPL Partner." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This Partner or branch is outside your access." }, 403);
    if (result.kind === "unavailable") return json({ ok: false, error: "Rate-card storage is unavailable." }, 503);
    if (result.kind !== "created") return json({ ok: false, error: "Enter a valid buy rate." }, 400);
    return json({ ok: true, rateCard: result.rateCard }, 201);
  }

  if (action === "select_rate") {
    const result = await selectTmsRate(clean(body.orderId, 120), clean(body.rateCardId, 120), actor, access.staff);
    if (result.kind === "missing") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This order is outside your branch access." }, 403);
    if (result.kind === "rate_unavailable") return json({ ok: false, error: "That rate is no longer valid for this order. Rate the order again." }, 409);
    if (result.kind === "unavailable") return json({ ok: false, error: "Rating storage is unavailable." }, 503);
    if (result.kind !== "selected") return json({ ok: false, error: "The rate could not be selected." }, 400);
    return json({ ok: true, result: result.result });
  }

  return json({ ok: false, error: "Unknown rating action." }, 400);
}
