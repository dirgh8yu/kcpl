import { getAdminAccess } from "../../../admin/admin-auth";
import { normalizeCommercialId } from "../../../admin/commercial-lineage/commercial-lineage";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../../../admin/crm/crm-data";
import {
  approveOrderPricing,
  calculateOrderPricing,
  createPricingRule,
  createQuoteFromOrderPricing,
  listPricingWorkspace,
  type PricingFxMode,
} from "../../../admin/pricing/tms-pricing.server";
import { deriveNrbMidpointFxRate, pricingRuleScopes, type PricingRuleScope } from "../../../admin/pricing/tms-pricing";
import { tmsModes, type TmsMode } from "../../../admin/rating/tms-rating";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { firebaseAdminDb } from "../../../firebase-admin.server";
import { getNrbForexSnapshot } from "../../../integrations/nrb-forex.server";
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

async function commercialPointer(orderId: string) {
  const id = orderId.trim().toUpperCase();
  if (!id) return { versionId: "", fingerprint: "" };
  const snapshot = await firebaseAdminDb().collection("transport_orders").doc(id).get();
  if (!snapshot.exists) return { versionId: "", fingerprint: "" };
  return {
    versionId: normalizeCommercialId(snapshot.get("commercial_version_id")),
    fingerprint: clean(snapshot.get("commercial_fingerprint"), 128),
  };
}

async function inferFxMode(orderId: string, sellCurrency: CrmCurrency | null, suppliedRate: number | null): Promise<PricingFxMode | null> {
  if (!sellCurrency || !suppliedRate || suppliedRate <= 0) return null;
  const order = await firebaseAdminDb().collection("transport_orders").doc(orderId.trim().toUpperCase()).get();
  if (!order.exists) return null;
  const buyCurrency = clean(order.get("selected_currency"), 10) as CrmCurrency;
  if (!crmCurrencies.includes(buyCurrency) || buyCurrency === sellCurrency) return "manual";
  try {
    const snapshot = await getNrbForexSnapshot();
    const nrbRate = deriveNrbMidpointFxRate(buyCurrency, sellCurrency, snapshot.rates);
    if (nrbRate && Math.abs(nrbRate - suppliedRate) <= 0.000000001) return "nrb";
  } catch {
    // A manual rate remains usable if the NRB reference endpoint is unavailable.
  }
  return "manual";
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
      name: clean(body.name, 180), scope, priority: optionalNumber(body.priority) ?? 0, branch,
      customerId: clean(body.customerId, 120) || null, origin: clean(body.origin, 180) || null, destination: clean(body.destination, 180) || null,
      mode, sellCurrency, markupPercent: optionalNumber(body.markupPercent), targetMarginPercent: optionalNumber(body.targetMarginPercent),
      minimumMarginPercent: optionalNumber(body.minimumMarginPercent) ?? 10, accessorialMarkupPercent: optionalNumber(body.accessorialMarkupPercent) ?? 15,
      fixedMarkup: optionalNumber(body.fixedMarkup) ?? 0, approvalBelowMarginPercent: optionalNumber(body.approvalBelowMarginPercent) ?? 12,
      notes: clean(body.notes, 2000) || null, active: booleanValue(body.active),
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
    const orderId = clean(body.orderId, 120);
    const sellCurrencyRaw = clean(body.sellCurrency, 10);
    const sellCurrency = sellCurrencyRaw ? sellCurrencyRaw as CrmCurrency : null;
    if (sellCurrency && !crmCurrencies.includes(sellCurrency)) return json({ ok: false, error: "Choose a valid sell currency." }, 400);
    const suppliedRate = optionalNumber(body.fxRate);
    const explicitFxMode = clean(body.fxMode, 20);
    const fxMode: PricingFxMode | null = explicitFxMode === "nrb" || explicitFxMode === "manual"
      ? explicitFxMode
      : await inferFxMode(orderId, sellCurrency, suppliedRate);
    const result = await calculateOrderPricing(orderId, {
      sellCurrency, fxMode, fxRate: suppliedRate,
      markupPercent: optionalNumber(body.markupPercent), targetMarginPercent: optionalNumber(body.targetMarginPercent),
      minimumMarginPercent: optionalNumber(body.minimumMarginPercent), approvalBelowMarginPercent: optionalNumber(body.approvalBelowMarginPercent),
      accessorialCost: optionalNumber(body.accessorialCost), accessorialMarkupPercent: optionalNumber(body.accessorialMarkupPercent),
      fixedMarkup: optionalNumber(body.fixedMarkup), discount: optionalNumber(body.discount),
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This order is outside your commercial access." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found or it does not have a selected buy cost." }, 404);
    if (result.kind === "customer_required") return json({ ok: false, error: "Link this transport order to a KCPL customer before pricing it." }, 409);
    if (result.kind === "customer_missing") return json({ ok: false, error: "The linked customer could not be found." }, 404);
    if (result.kind === "fx_unavailable") return json({ ok: false, error: "NRB FX reference is temporarily unavailable. Enter an explicit manual FX rate if commercial policy permits it." }, 502);
    if (result.kind === "fx_required") return json({ ok: false, error: `Enter the ${result.buyCurrency} → ${result.sellCurrency} FX rate before calculating the sell price.`, fxRequired: true }, 409);
    if (result.kind === "locked") return json({ ok: false, error: "Commercial economics are locked at this workflow stage. Cancel/re-tender or use the explicit counteroffer review path." }, 409);
    if (result.kind === "commercial_review_required") return json({ ok: false, error: "The order's historical commercial basis cannot be proven automatically. Commercial review is required.", reason: result.reason }, 409);
    if (result.kind === "invalid_currency" || result.kind === "invalid_pricing") return json({ ok: false, error: "Pricing inputs are invalid." }, 400);
    return json({ ok: true, status: result.kind, preview: result.preview });
  }

  if (action === "approve") {
    const orderId = clean(body.orderId, 120);
    const pointer = await commercialPointer(orderId);
    const result = await approveOrderPricing(orderId, clean(body.note, 2000), actor, access.staff, pointer.versionId, pointer.fingerprint);
    if (result.kind === "unavailable") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "Management approval is required." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "pricing_required") return json({ ok: false, error: "Calculate the sell price before approval." }, 409);
    if (result.kind === "stale_commercial_state") return json({ ok: false, error: "Commercials changed while approval was being applied. Review the new version before approving." }, 409);
    if (result.kind === "not_required") return json({ ok: true, status: "not_required" });
    return json({ ok: true, status: "approved", preview: result.preview });
  }

  if (action === "create_quote") {
    const orderId = clean(body.orderId, 120);
    const pointer = await commercialPointer(orderId);
    const result = await createQuoteFromOrderPricing(orderId, clean(body.validUntil, 20) || null, clean(body.customerNote, 3000), actor, access.staff, pointer.versionId, pointer.fingerprint);
    if (result.kind === "unavailable") return json({ ok: false, error: "Pricing storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "Commercial access is required." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "customer_required" || result.kind === "customer_missing") return json({ ok: false, error: "A valid KCPL customer is required before quote release." }, 409);
    if (result.kind === "pricing_required") return json({ ok: false, error: "Calculate the sell price before creating the quote." }, 409);
    if (result.kind === "approval_required") return json({ ok: false, error: "This exact commercial version requires Management approval before release." }, 409);
    if (result.kind === "stale_commercial_state") return json({ ok: false, error: "Commercials changed while the quote was being created. Review the latest version and retry." }, 409);
    if (result.kind === "invalid_validity") return json({ ok: false, error: "Quote validity must be a valid date." }, 400);
    return json({ ok: true, quoteReference: result.quoteReference, preview: result.preview }, result.idempotent ? 200 : 201);
  }

  return json({ ok: false, error: "Unknown pricing action." }, 400);
}
