import { getAdminAccess } from "../../../admin/admin-auth";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../../../admin/crm/crm-data";
import {
  approveOrderPricing,
  calculateOrderPricing,
  createPricingRule,
  createQuoteFromOrderPricing,
  listPricingWorkspace,
} from "../../../admin/pricing/tms-pricing.server";
import { pricingRuleScopes, type PricingRuleScope } from "../../../admin/pricing/tms-pricing";
import { tmsModes, type TmsMode } from "../../../admin/rating/tms-rating";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function booleanValue(value: unknown, fallback = true) { return typeof value === "boolean" ? value : fallback; }

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
  const result = await listPricingWorkspace(access.staff);
  if (result.kind !== "ready") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
  return json({ ok: true, ...result, canManageRules: access.staff.permissions.canManageRateCards, canApprove: access.staff.permissions.role === "management" });
}

export async function POST(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin pricing updates are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = clean(body.action, 40);
  const actor = { name: access.user.displayName, email: access.user.email };

  if (action === "create_rule") {
    const scope = clean(body.scope, 40) as PricingRuleScope;
    const branchRaw = clean(body.branch, 60);
    const modeRaw = clean(body.mode, 30);
    const currencyRaw = clean(body.sellCurrency, 10);
    if (!pricingRuleScopes.includes(scope)) return json({ ok: false, error: "Choose a valid pricing rule scope." }, 400);
    const branch = branchRaw ? branchRaw as KcplBranch : null;
    const mode = modeRaw ? modeRaw as TmsMode : null;
    const sellCurrency = currencyRaw ? currencyRaw as CrmCurrency : null;
    if (branch && !kcplBranches.includes(branch)) return json({ ok: false, error: "Choose a valid branch." }, 400);
    if (mode && !tmsModes.includes(mode)) return json({ ok: false, error: "Choose a valid transport mode." }, 400);
    if (sellCurrency && !crmCurrencies.includes(sellCurrency)) return json({ ok: false, error: "Choose a valid sell currency." }, 400);
    const result = await createPricingRule({
      name: clean(body.name, 180),
      scope,
      priority: optionalNumber(body.priority) ?? 0,
      branch,
      customerId: clean(body.customerId, 120) || null,
      origin: clean(body.origin, 180) || null,
      destination: clean(body.destination, 180) || null,
      mode,
      sellCurrency,
      markupPercent: optionalNumber(body.markupPercent),
      targetMarginPercent: optionalNumber(body.targetMarginPercent),
      minimumMarginPercent: optionalNumber(body.minimumMarginPercent) ?? 10,
      accessorialMarkupPercent: optionalNumber(body.accessorialMarkupPercent) ?? 15,
      fixedMarkup: optionalNumber(body.fixedMarkup) ?? 0,
      approvalBelowMarginPercent: optionalNumber(body.approvalBelowMarginPercent) ?? 12,
      notes: clean(body.notes, 2000) || null,
      active: booleanValue(body.active),
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "You cannot manage pricing rules for this scope." }, 403);
    if (result.kind === "customer_required") return json({ ok: false, error: "This pricing scope requires a customer." }, 400);
    if (result.kind === "customer_missing") return json({ ok: false, error: "Customer not found." }, 404);
    if (result.kind === "lane_required") return json({ ok: false, error: "Lane pricing requires both origin and destination." }, 400);
    if (result.kind !== "created") return json({ ok: false, error: "The pricing rule is invalid." }, 400);
    return json({ ok: true, rule: result.rule }, 201);
  }

  if (action === "calculate") {
    const sellCurrencyRaw = clean(body.sellCurrency, 10);
    const sellCurrency = sellCurrencyRaw ? sellCurrencyRaw as CrmCurrency : null;
    if (sellCurrency && !crmCurrencies.includes(sellCurrency)) return json({ ok: false, error: "Choose a valid sell currency." }, 400);
    const result = await calculateOrderPricing(clean(body.orderId, 120), {
      sellCurrency,
      fxRate: optionalNumber(body.fxRate),
      markupPercent: optionalNumber(body.markupPercent),
      targetMarginPercent: optionalNumber(body.targetMarginPercent),
      minimumMarginPercent: optionalNumber(body.minimumMarginPercent),
      approvalBelowMarginPercent: optionalNumber(body.approvalBelowMarginPercent),
      accessorialCost: optionalNumber(body.accessorialCost),
      accessorialMarkupPercent: optionalNumber(body.accessorialMarkupPercent),
      fixedMarkup: optionalNumber(body.fixedMarkup),
      discount: optionalNumber(body.discount),
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This order is outside your commercial access." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found or it does not have a selected buy cost." }, 404);
    if (result.kind === "customer_required") return json({ ok: false, error: "Link this transport order to a KCPL customer before pricing it." }, 409);
    if (result.kind === "customer_missing") return json({ ok: false, error: "The linked customer could not be found." }, 404);
    if (result.kind === "fx_required") return json({ ok: false, error: `Enter the ${result.buyCurrency} → ${result.sellCurrency} FX rate before calculating the sell price.`, fxRequired: true }, 409);
    if (result.kind === "locked") return json({ ok: false, error: "Cancelled orders cannot be priced." }, 409);
    if (result.kind === "invalid_currency" || result.kind === "invalid_pricing") return json({ ok: false, error: "Pricing inputs are invalid." }, 400);
    return json({ ok: true, status: result.kind, preview: result.preview });
  }

  if (action === "approve") {
    const result = await approveOrderPricing(clean(body.orderId, 120), clean(body.note, 2000), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "Management approval is required." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "pricing_required") return json({ ok: false, error: "Calculate the sell price before approval." }, 409);
    if (result.kind === "not_required") return json({ ok: true, status: "not_required" });
    return json({ ok: true, status: "approved", preview: result.preview });
  }

  if (action === "create_quote") {
    const result = await createQuoteFromOrderPricing(clean(body.orderId, 120), clean(body.validUntil, 20) || null, clean(body.customerNote, 3000), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "Commercial access is required." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "customer_required" || result.kind === "customer_missing") return json({ ok: false, error: "A valid KCPL customer is required before quote release." }, 409);
    if (result.kind === "pricing_required") return json({ ok: false, error: "Calculate the sell price before creating the quote." }, 409);
    if (result.kind === "approval_required") return json({ ok: false, error: "This price is below the approval threshold. Management must approve it before release." }, 409);
    if (result.kind === "invalid_validity") return json({ ok: false, error: "Quote validity must be a valid date." }, 400);
    return json({ ok: true, quoteReference: result.quoteReference, preview: result.preview }, 201);
  }

  return json({ ok: false, error: "Unknown pricing action." }, 400);
}
