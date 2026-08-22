import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { getNrbForexSnapshot, type NrbForexSnapshot } from "../../integrations/nrb-forex.server";
import {
  commercialEventPayload,
  commercialOrderPointer,
  createCommercialApprovalInTransaction,
  loadCommercialApprovalInTransaction,
  newCommercialVersion,
  persistCommercialVersionInTransaction,
  resolveCurrentCommercialVersionInTransaction,
} from "../commercial-lineage/commercial-lineage.server";
import {
  commercialApprovalSatisfied,
  normalizeCommercialCurrency,
  normalizeCommercialId,
  type CommercialFxSnapshot,
  type CommercialPricingSnapshot,
  type CommercialVersion,
  type CommercialVersionReason,
} from "../commercial-lineage/commercial-lineage";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { tmsModes, type TmsMode } from "../rating/tms-rating";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  calculateSellPrice,
  pricingRuleScopes,
  resolvePricingRule,
  rulePricingDefaults,
  type CustomerPricingProfile,
  type PricingInput,
  type PricingOrderCandidate,
  type PricingPreview,
  type PricingRule,
  type PricingRuleScope,
} from "./tms-pricing";

type Actor = { name: string; email: string };

type PricingRuleInput = {
  name: string;
  scope: PricingRuleScope;
  priority: number;
  branch?: KcplBranch | null;
  customerId?: string | null;
  origin?: string | null;
  destination?: string | null;
  mode?: TmsMode | null;
  sellCurrency?: CrmCurrency | null;
  markupPercent?: number | null;
  targetMarginPercent?: number | null;
  minimumMarginPercent: number;
  accessorialMarkupPercent: number;
  fixedMarkup: number;
  approvalBelowMarginPercent: number;
  notes?: string | null;
  active: boolean;
};

export type PricingFxMode = "nrb" | "manual";

type PricingOverrides = {
  sellCurrency?: CrmCurrency | null;
  fxMode?: PricingFxMode | null;
  fxRate?: number | null;
  markupPercent?: number | null;
  targetMarginPercent?: number | null;
  minimumMarginPercent?: number | null;
  approvalBelowMarginPercent?: number | null;
  accessorialCost?: number | null;
  accessorialMarkupPercent?: number | null;
  fixedMarkup?: number | null;
  discount?: number | null;
};

type StoredPricingSnapshot = PricingPreview & {
  id: string;
  commercial_version_id: string;
  commercial_fingerprint: string;
  approval_status: "not_required" | "pending" | "approved" | "rejected";
  calculated_at: string;
  calculated_by_name: string;
  calculated_by_email: string;
  approved_at: string | null;
  approved_by_name: string | null;
  approved_by_email: string | null;
  fx_source: string;
  fx_effective_date: string | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function num(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNum(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function currencyValue(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function modeValue(value: unknown): TmsMode | null { return tmsModes.includes(value as TmsMode) ? value as TmsMode : null; }
function scopeValue(value: unknown): PricingRuleScope | null { return pricingRuleScopes.includes(value as PricingRuleScope) ? value as PricingRuleScope : null; }
function childId(prefix: string) { return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`; }
function pricingSnapshotId() { return `PRICE-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`; }
function quoteReference(orderId: string, versionId: string) { return `TMSSELL-${orderId}-${versionId}`.replace(/[^A-Z0-9-]/gi, "").toUpperCase().slice(0, 120); }

function pricingRuleFromData(id: string, data: Record<string, unknown>): PricingRule | null {
  const scope = scopeValue(data.scope);
  if (!scope) return null;
  return {
    id,
    name: text(data.name, id),
    active: data.active !== false,
    priority: Math.trunc(num(data.priority)),
    scope,
    branch: branchValue(data.branch),
    customer_id: nullable(data.customer_id),
    origin: nullable(data.origin),
    destination: nullable(data.destination),
    mode: modeValue(data.mode),
    sell_currency: currencyValue(data.sell_currency),
    markup_percent: nullableNum(data.markup_percent),
    target_margin_percent: nullableNum(data.target_margin_percent),
    minimum_margin_percent: Math.max(0, num(data.minimum_margin_percent, 10)),
    accessorial_markup_percent: Math.max(0, num(data.accessorial_markup_percent, 15)),
    fixed_markup: Math.max(0, num(data.fixed_markup)),
    approval_below_margin_percent: Math.max(0, num(data.approval_below_margin_percent, 12)),
    notes: nullable(data.notes),
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
  };
}

function customerFromData(id: string, data: Record<string, unknown>): CustomerPricingProfile | null {
  const preferredCurrency = currencyValue(data.preferred_currency);
  const branch = branchValue(data.primary_branch);
  if (!preferredCurrency || !branch || data.archived === true) return null;
  return {
    id,
    display_name: text(data.display_name, id),
    preferred_currency: preferredCurrency,
    markup_percent: nullableNum(data.markup_percent),
    pricing_notes: nullable(data.pricing_notes),
    primary_branch: branch,
  };
}

function pricingStatus(value: unknown): PricingOrderCandidate["pricing_status"] {
  return ["priced", "approval_required", "quoted"].includes(text(value)) ? text(value) as PricingOrderCandidate["pricing_status"] : "unpriced";
}

function orderCandidateFromData(id: string, data: Record<string, unknown>): PricingOrderCandidate | null {
  const branch = branchValue(data.branch);
  const mode = modeValue(data.mode);
  const buyCurrency = currencyValue(data.selected_currency);
  const buyCost = nullableNum(data.selected_cost);
  if (!branch || !mode || !buyCurrency || buyCost === null || buyCost < 0 || data.is_consolidation_master === true) return null;
  return {
    id,
    branch,
    customer_id: nullable(data.customer_id),
    customer_name: nullable(data.customer_name),
    origin: text(data.origin),
    destination: text(data.destination),
    mode,
    buy_cost: buyCost,
    buy_currency: buyCurrency,
    status: text(data.status, "draft"),
    pricing_status: pricingStatus(data.pricing_status),
    quoted_reference: nullable(data.quoted_reference),
  };
}

async function getCustomer(customerId: string | null) {
  if (!customerId) return null;
  const ref = firebaseAdminDb().collection("customers").doc(customerId.trim().toUpperCase());
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const customer = customerFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  return customer ? { ref, snapshot, customer } : null;
}

export async function listPricingRules(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("pricing_rules").orderBy("updated_at", "desc").limit(1000).get();
  const rules = snapshot.docs.map((doc) => pricingRuleFromData(doc.id, doc.data() as Record<string, unknown>))
    .filter((rule): rule is PricingRule => Boolean(rule))
    .filter((rule) => !rule.branch || staffCanAccessBranch(staff, rule.branch));
  return { kind: "ready" as const, rules };
}

export async function listPricingWorkspace(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const [orderSnapshot, rulesResult] = await Promise.all([
    firebaseAdminDb().collection("transport_orders").orderBy("updated_at", "desc").limit(750).get(),
    listPricingRules(staff),
  ]);
  if (rulesResult.kind !== "ready") return rulesResult;
  const orders = orderSnapshot.docs.map((doc) => orderCandidateFromData(doc.id, doc.data() as Record<string, unknown>))
    .filter((order): order is PricingOrderCandidate => Boolean(order))
    .filter((order) => staffCanAccessBranch(staff, order.branch));
  const customerIds = [...new Set(orders.flatMap((order) => order.customer_id ? [order.customer_id] : []))];
  const customerSnapshots = customerIds.length ? await firebaseAdminDb().getAll(...customerIds.map((id) => firebaseAdminDb().collection("customers").doc(id))) : [];
  const customers = customerSnapshots.filter((snapshot) => snapshot.exists)
    .map((snapshot) => customerFromData(snapshot.id, snapshot.data() as Record<string, unknown>))
    .filter((customer): customer is CustomerPricingProfile => Boolean(customer))
    .filter((customer) => staffCanAccessBranch(staff, customer.primary_branch));
  return { kind: "ready" as const, orders, customers, rules: rulesResult.rules };
}

export async function createPricingRule(input: PricingRuleInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canManageRateCards) return { kind: "forbidden" as const };
  if (!pricingRuleScopes.includes(input.scope)) return { kind: "invalid" as const };
  if (input.branch && !staffCanAccessBranch(staff, input.branch)) return { kind: "forbidden" as const };
  if (input.mode && !tmsModes.includes(input.mode)) return { kind: "invalid" as const };
  if (input.sellCurrency && !crmCurrencies.includes(input.sellCurrency)) return { kind: "invalid" as const };
  const customerId = input.customerId?.trim().toUpperCase() || null;
  if ((input.scope === "customer" || input.scope === "customer_lane") && !customerId) return { kind: "customer_required" as const };
  if ((input.scope === "lane" || input.scope === "customer_lane") && (!input.origin?.trim() || !input.destination?.trim())) return { kind: "lane_required" as const };
  if (customerId) {
    const customer = await getCustomer(customerId);
    if (!customer) return { kind: "customer_missing" as const };
    if (!staffCanAccessBranch(staff, customer.customer.primary_branch)) return { kind: "forbidden" as const };
  }
  const percentages = [input.markupPercent, input.targetMarginPercent, input.minimumMarginPercent, input.accessorialMarkupPercent, input.approvalBelowMarginPercent].filter((value): value is number => value !== null && value !== undefined);
  if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value >= 100)) return { kind: "invalid" as const };
  if (!Number.isFinite(input.fixedMarkup) || input.fixedMarkup < 0) return { kind: "invalid" as const };
  const id = `PR-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  const data = {
    name: input.name.trim() || id, active: input.active, priority: Math.trunc(input.priority || 0), scope: input.scope,
    branch: input.branch || null, customer_id: customerId, origin: input.origin?.trim() || null, destination: input.destination?.trim() || null,
    mode: input.mode || null, sell_currency: input.sellCurrency || null, markup_percent: input.markupPercent ?? null,
    target_margin_percent: input.targetMarginPercent ?? null, minimum_margin_percent: input.minimumMarginPercent,
    accessorial_markup_percent: input.accessorialMarkupPercent, fixed_markup: input.fixedMarkup,
    approval_below_margin_percent: input.approvalBelowMarginPercent, notes: input.notes?.trim() || null,
    created_by_name: actor.name, created_by_email: actor.email, created_at: now, updated_at: now,
  };
  await firebaseAdminDb().collection("pricing_rules").doc(id).create(data);
  return { kind: "created" as const, rule: pricingRuleFromData(id, data)! };
}

function nrbFx(snapshot: NrbForexSnapshot, sourceCurrency: CrmCurrency, targetCurrency: CrmCurrency): CommercialFxSnapshot | null {
  const nprPerUnit = (currency: CrmCurrency) => {
    if (currency === "NPR") return 1;
    const rate = snapshot.rates.find((item) => item.currency === currency);
    return rate?.midpoint_per_unit && rate.midpoint_per_unit > 0 ? rate.midpoint_per_unit : null;
  };
  const sourceNpr = nprPerUnit(sourceCurrency);
  const targetNpr = nprPerUnit(targetCurrency);
  if (!sourceNpr || !targetNpr) return null;
  return {
    source_currency: sourceCurrency,
    target_currency: targetCurrency,
    rate: sourceNpr / targetNpr,
    source: `${snapshot.provider} · ${snapshot.source}`,
    effective_date: snapshot.date,
    published_on: snapshot.published_on,
    modified_on: snapshot.modified_on,
    source_npr_per_unit: sourceNpr,
    target_npr_per_unit: targetNpr,
  };
}

function manualFx(sourceCurrency: CrmCurrency, targetCurrency: CrmCurrency, rate: number): CommercialFxSnapshot {
  return {
    source_currency: sourceCurrency, target_currency: targetCurrency, rate, source: "manual_override",
    effective_date: null, published_on: null, modified_on: null, source_npr_per_unit: null, target_npr_per_unit: null,
  };
}

function sameCurrencyFx(currency: CrmCurrency): CommercialFxSnapshot {
  return {
    source_currency: currency, target_currency: currency, rate: 1, source: "same_currency",
    effective_date: null, published_on: null, modified_on: null, source_npr_per_unit: null, target_npr_per_unit: null,
  };
}

function pricingReason(previous: CommercialVersion, input: PricingInput): CommercialVersionReason {
  if (!previous.snapshot.pricing) return "repriced";
  if (previous.snapshot.pricing.discount !== input.discount) return "discount_changed";
  if ((previous.snapshot.fx?.rate ?? null) !== input.fx_rate) return "fx_refreshed";
  return "repriced";
}

function storedProjection(input: {
  id: string;
  version: CommercialVersion;
  order: PricingOrderCandidate;
  customer: CustomerPricingProfile;
  rule: PricingRule | null;
  pricingInput: PricingInput;
  result: ReturnType<typeof calculateSellPrice>;
  actor: Actor;
  approvalStatus: StoredPricingSnapshot["approval_status"];
  approval?: { approved_at: string; approved_by_name: string; approved_by_email: string } | null;
}) {
  const { version } = input;
  const fx = version.snapshot.fx;
  return {
    id: input.id,
    commercial_version_id: version.id,
    commercial_fingerprint: version.fingerprint,
    order: input.order,
    customer: input.customer,
    rule: input.rule,
    input: input.pricingInput,
    result: input.result,
    approval_status: input.approvalStatus,
    calculated_at: version.created_at,
    calculated_by_name: version.created_by_name,
    calculated_by_email: version.created_by_email,
    approved_at: input.approval?.approved_at ?? null,
    approved_by_name: input.approval?.approved_by_name ?? null,
    approved_by_email: input.approval?.approved_by_email ?? null,
    fx_source: fx?.source ?? "none",
    fx_effective_date: fx?.effective_date ?? null,
  } satisfies StoredPricingSnapshot;
}

export async function calculateOrderPricing(orderId: string, overrides: PricingOverrides, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  let nrbSnapshot: NrbForexSnapshot | null = null;
  if (overrides.fxMode === "nrb") {
    try { nrbSnapshot = await getNrbForexSnapshot(); }
    catch { return { kind: "fx_unavailable" as const }; }
  }
  const db = firebaseAdminDb();
  const orderRef = db.collection("transport_orders").doc(orderId.trim().toUpperCase());
  const eventRef = orderRef.collection("events").doc(childId("evt"));
  try {
    return await db.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) return { kind: "missing_order" as const };
      const data = orderSnapshot.data() as Record<string, unknown>;
      const order = orderCandidateFromData(orderSnapshot.id, data);
      if (!order) return { kind: "missing_order" as const };
      if (!staffCanAccessBranch(staff, order.branch)) return { kind: "forbidden" as const };
      if (!order.customer_id) return { kind: "customer_required" as const };
      if (["booked", "cancelled"].includes(order.status)) return { kind: "locked" as const };

      const customerRef = db.collection("customers").doc(order.customer_id.trim().toUpperCase());
      const [customerSnapshot, rulesSnapshot] = await Promise.all([
        transaction.get(customerRef),
        transaction.get(db.collection("pricing_rules").limit(1000)),
      ]);
      if (!customerSnapshot.exists) return { kind: "customer_missing" as const };
      const customer = customerFromData(customerSnapshot.id, customerSnapshot.data() as Record<string, unknown>);
      if (!customer || !staffCanAccessBranch(staff, customer.primary_branch) || customer.primary_branch !== order.branch) return { kind: "customer_missing" as const };
      const rules = rulesSnapshot.docs.map((doc) => pricingRuleFromData(doc.id, doc.data() as Record<string, unknown>))
        .filter((rule): rule is PricingRule => Boolean(rule))
        .filter((rule) => !rule.branch || staffCanAccessBranch(staff, rule.branch));
      const rule = resolvePricingRule(rules, order);
      const resolved = await resolveCurrentCommercialVersionInTransaction(transaction, orderSnapshot, actor);
      if (resolved.kind !== "ready") return { kind: "commercial_review_required" as const, reason: resolved.kind === "commercial_review_required" ? resolved.reason : "commercial_version_required" };
      const previous = resolved.version;
      if (normalizeCommercialId(previous.snapshot.customer_id) !== normalizeCommercialId(order.customer_id)) return { kind: "commercial_review_required" as const, reason: "commercial_customer_mismatch" };

      let counterTender: FirebaseFirestore.DocumentSnapshot | null = null;
      if (order.status === "tendering") {
        if (previous.reason !== "counteroffer" || previous.snapshot.pricing?.converted_buy_cost !== null) return { kind: "locked" as const };
        const tenderId = normalizeCommercialId(data.active_tender_id);
        if (!tenderId) return { kind: "commercial_review_required" as const, reason: "counteroffer_tender_missing" };
        counterTender = await transaction.get(db.collection("transport_tenders").doc(tenderId));
        if (!counterTender.exists || text(counterTender.get("status")) !== "countered"
          || normalizeCommercialId(counterTender.get("commercial_version_id")) !== previous.id
          || text(counterTender.get("commercial_fingerprint")) !== previous.fingerprint) {
          return { kind: "commercial_review_required" as const, reason: "counteroffer_lineage_mismatch" };
        }
      }

      const defaults = rulePricingDefaults(rule, customer.markup_percent);
      const buyCurrency = normalizeCommercialCurrency(previous.snapshot.procurement.currency) as CrmCurrency;
      const buyCost = previous.snapshot.procurement.total;
      const sellCurrency = overrides.sellCurrency ?? rule?.sell_currency ?? customer.preferred_currency ?? buyCurrency;
      if (!crmCurrencies.includes(sellCurrency)) return { kind: "invalid_currency" as const };
      let fx: CommercialFxSnapshot;
      if (buyCurrency === sellCurrency) fx = sameCurrencyFx(buyCurrency);
      else if (overrides.fxMode === "nrb") {
        const resolvedFx = nrbSnapshot ? nrbFx(nrbSnapshot, buyCurrency, sellCurrency) : null;
        if (!resolvedFx?.rate) return { kind: "fx_required" as const, buyCurrency, sellCurrency };
        fx = resolvedFx;
      } else {
        const rate = overrides.fxRate ?? 0;
        if (!Number.isFinite(rate) || rate <= 0) return { kind: "fx_required" as const, buyCurrency, sellCurrency };
        fx = manualFx(buyCurrency, sellCurrency, rate);
      }

      const pricingInput: PricingInput = {
        buy_cost: buyCost,
        buy_currency: buyCurrency,
        sell_currency: sellCurrency,
        fx_rate: fx.rate ?? 0,
        markup_percent: overrides.markupPercent ?? defaults.markup_percent,
        target_margin_percent: overrides.targetMarginPercent ?? defaults.target_margin_percent,
        minimum_margin_percent: overrides.minimumMarginPercent ?? defaults.minimum_margin_percent,
        approval_below_margin_percent: overrides.approvalBelowMarginPercent ?? defaults.approval_below_margin_percent,
        accessorial_cost: Math.max(0, overrides.accessorialCost ?? 0),
        accessorial_markup_percent: overrides.accessorialMarkupPercent ?? defaults.accessorial_markup_percent,
        fixed_markup: overrides.fixedMarkup ?? defaults.fixed_markup,
        discount: Math.max(0, overrides.discount ?? 0),
      };
      let result: ReturnType<typeof calculateSellPrice>;
      try { result = calculateSellPrice(pricingInput); }
      catch { return { kind: "invalid_pricing" as const }; }
      if (!Number.isFinite(result.sell_price) || !Number.isFinite(result.minimum_sell_price)) return { kind: "invalid_pricing" as const };

      const pricing: CommercialPricingSnapshot = {
        customer_id: customer.id,
        pricing_rule_id: rule?.id ?? null,
        pricing_rule_scope: rule?.scope ?? null,
        markup_percent: pricingInput.markup_percent,
        target_margin_percent: pricingInput.target_margin_percent ?? null,
        minimum_margin_percent: pricingInput.minimum_margin_percent,
        approval_below_margin_percent: pricingInput.approval_below_margin_percent,
        accessorial_cost: pricingInput.accessorial_cost,
        accessorial_markup_percent: pricingInput.accessorial_markup_percent,
        fixed_markup: pricingInput.fixed_markup,
        discount: pricingInput.discount,
        converted_buy_cost: result.converted_buy_cost,
        accessorial_sell: result.accessorial_sell,
        pre_discount_sell: result.pre_discount_sell,
        sell_amount: result.sell_price,
        sell_currency: sellCurrency,
        gross_profit: result.gross_profit,
        gross_margin_percent: result.gross_margin_percent,
        effective_markup_percent: result.effective_markup_percent,
        minimum_sell_price: result.minimum_sell_price,
        approval_required: result.approval_required,
        approval_reasons: result.approval_reasons,
      };
      const version = newCommercialVersion({
        snapshot: { ...previous.snapshot, pricing, fx },
        previousVersionId: previous.id,
        reason: pricingReason(previous, pricingInput),
        actor,
        sourceReferences: {
          rate_card_id: previous.snapshot.procurement.rate_card_id,
          pricing_rule_id: rule?.id ?? null,
          customer_id: customer.id,
          tender_id: counterTender?.id ?? null,
        },
      });
      if (resolved.legacy_reconstructed) persistCommercialVersionInTransaction(transaction, previous);
      persistCommercialVersionInTransaction(transaction, version);
      const projection = storedProjection({
        id: pricingSnapshotId(), version, order: { ...order, buy_cost: buyCost, buy_currency: buyCurrency }, customer, rule, pricingInput, result, actor,
        approvalStatus: result.approval_required ? "pending" : "not_required",
      });
      const now = new Date().toISOString();
      transaction.update(orderRef, {
        selected_cost: buyCost,
        selected_currency: buyCurrency,
        pricing_status: result.approval_required ? "approval_required" : "priced",
        pricing_snapshot: projection,
        quoted_reference: null,
        ...commercialOrderPointer(version),
        updated_at: now,
      });
      if (counterTender) {
        transaction.update(counterTender.ref, {
          commercial_version_id: version.id,
          commercial_fingerprint: version.fingerprint,
          final_commercial_version_id: version.id,
          final_commercial_fingerprint: version.fingerprint,
          updated_at: now,
        });
      }
      transaction.create(eventRef, commercialEventPayload(version, "commercial_version_created", actor, `${sellCurrency} ${result.sell_price.toFixed(sellCurrency === "JPY" ? 0 : 2)} · margin ${result.gross_margin_percent.toFixed(2)}%`));
      return { kind: result.approval_required ? "approval_required" as const : "priced" as const, preview: projection };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function approveOrderPricing(
  orderId: string,
  note: string,
  actor: Actor,
  staff: KcplStaffContext,
  expectedVersionId?: string | null,
  expectedFingerprint?: string | null,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (staff.permissions.role !== "management") return { kind: "forbidden" as const };
  const expectedId = normalizeCommercialId(expectedVersionId);
  const expectedFp = text(expectedFingerprint);
  if (!expectedId || !expectedFp) return { kind: "stale_commercial_state" as const };
  const db = firebaseAdminDb();
  const orderRef = db.collection("transport_orders").doc(orderId.trim().toUpperCase());
  const eventRef = orderRef.collection("events").doc(childId("evt"));
  try {
    return await db.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) return { kind: "missing_order" as const };
      const branch = branchValue(order.get("branch"));
      if (!branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      if (normalizeCommercialId(order.get("commercial_version_id")) !== expectedId || text(order.get("commercial_fingerprint")) !== expectedFp) return { kind: "stale_commercial_state" as const };
      const resolved = await resolveCurrentCommercialVersionInTransaction(transaction, order, actor);
      if (resolved.kind !== "ready" || resolved.version.id !== expectedId || resolved.version.fingerprint !== expectedFp) return { kind: "stale_commercial_state" as const };
      const version = resolved.version;
      if (!version.snapshot.pricing) return { kind: "pricing_required" as const };
      if (!version.snapshot.pricing.approval_required) return { kind: "not_required" as const };
      const existing = await loadCommercialApprovalInTransaction(transaction, version);
      const raw = order.get("pricing_snapshot");
      if (!raw || typeof raw !== "object") return { kind: "pricing_required" as const };
      const projection = raw as StoredPricingSnapshot;
      if (projection.commercial_version_id !== version.id || projection.commercial_fingerprint !== version.fingerprint) return { kind: "stale_commercial_state" as const };
      if (existing) {
        const preview: StoredPricingSnapshot = { ...projection, approval_status: "approved", approved_at: existing.approved_at, approved_by_name: existing.approved_by_name, approved_by_email: existing.approved_by_email };
        return { kind: "approved" as const, preview, idempotent: true };
      }
      const now = new Date().toISOString();
      const approval = createCommercialApprovalInTransaction(transaction, version, actor, note, now);
      const approved: StoredPricingSnapshot = { ...projection, approval_status: "approved", approved_at: now, approved_by_name: actor.name, approved_by_email: actor.email };
      transaction.update(orderRef, {
        pricing_status: "priced",
        pricing_snapshot: approved,
        pricing_approval_status: "approved",
        pricing_approval_version_id: version.id,
        pricing_approval_fingerprint: version.fingerprint,
        updated_at: now,
      });
      transaction.create(eventRef, {
        ...commercialEventPayload(version, "pricing_approved_for_version", actor, note.trim() || version.snapshot.pricing.approval_reasons.join(" ")),
        approved_at: approval.approved_at,
      });
      return { kind: "approved" as const, preview: approved, idempotent: false };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function createQuoteFromOrderPricing(
  orderId: string,
  validUntil: string | null,
  customerNote: string,
  actor: Actor,
  staff: KcplStaffContext,
  expectedVersionId?: string | null,
  expectedFingerprint?: string | null,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const date = validUntil?.trim() || "";
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "invalid_validity" as const };
  const expectedId = normalizeCommercialId(expectedVersionId);
  const expectedFp = text(expectedFingerprint);
  if (!expectedId || !expectedFp) return { kind: "stale_commercial_state" as const };
  const db = firebaseAdminDb();
  const orderRef = db.collection("transport_orders").doc(orderId.trim().toUpperCase());
  const reference = quoteReference(orderRef.id, expectedId);
  const quoteRef = db.collection("quotes").doc(reference);
  const eventRef = orderRef.collection("events").doc(childId("evt"));
  try {
    return await db.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) return { kind: "missing_order" as const };
      const branch = branchValue(order.get("branch"));
      if (!branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      if (normalizeCommercialId(order.get("commercial_version_id")) !== expectedId || text(order.get("commercial_fingerprint")) !== expectedFp) return { kind: "stale_commercial_state" as const };
      const customerId = normalizeCommercialId(order.get("customer_id"));
      if (!customerId) return { kind: "customer_required" as const };
      const [customerSnapshot, quoteSnapshot] = await Promise.all([
        transaction.get(db.collection("customers").doc(customerId)),
        transaction.get(quoteRef),
      ]);
      if (!customerSnapshot.exists) return { kind: "customer_missing" as const };
      const customer = customerFromData(customerSnapshot.id, customerSnapshot.data() as Record<string, unknown>);
      if (!customer || customer.primary_branch !== branch || !staffCanAccessBranch(staff, customer.primary_branch)) return { kind: "customer_missing" as const };
      const resolved = await resolveCurrentCommercialVersionInTransaction(transaction, order, actor);
      if (resolved.kind !== "ready" || resolved.version.id !== expectedId || resolved.version.fingerprint !== expectedFp) return { kind: "stale_commercial_state" as const };
      const version = resolved.version;
      if (!version.snapshot.pricing) return { kind: "pricing_required" as const };
      const approval = await loadCommercialApprovalInTransaction(transaction, version);
      if (!commercialApprovalSatisfied(version, approval)) return { kind: "approval_required" as const };
      const raw = order.get("pricing_snapshot");
      if (!raw || typeof raw !== "object") return { kind: "pricing_required" as const };
      const projection = raw as StoredPricingSnapshot;
      if (projection.commercial_version_id !== version.id || projection.commercial_fingerprint !== version.fingerprint) return { kind: "stale_commercial_state" as const };
      if (quoteSnapshot.exists) {
        if (normalizeCommercialId(quoteSnapshot.get("commercial_version_id")) !== version.id || text(quoteSnapshot.get("commercial_fingerprint")) !== version.fingerprint) return { kind: "stale_commercial_state" as const };
        return { kind: "quoted" as const, quoteReference: reference, preview: projection, idempotent: true };
      }
      const pricing = version.snapshot.pricing;
      const decimals = pricing.sell_currency === "JPY" ? 0 : 2;
      const baseCost = (pricing.converted_buy_cost ?? 0) + Math.max(0, pricing.accessorial_cost);
      const now = new Date().toISOString();
      transaction.create(quoteRef, {
        reference,
        status: "quoted",
        source: "tms_sell_pricing_engine",
        migration_hidden: false,
        transport_order_id: order.id,
        customer_id: customer.id,
        company_name: customer.display_name,
        contact_name: "",
        contact_email: text(customerSnapshot.get("primary_email")),
        phone: text(customerSnapshot.get("primary_phone")),
        origin: text(order.get("origin")), destination: text(order.get("destination")), mode: text(order.get("mode")), cargo_type: "",
        quote_currency: pricing.sell_currency,
        quoted_amount: pricing.sell_amount.toFixed(decimals),
        internal_cost: baseCost.toFixed(decimals),
        valid_until: date || null,
        customer_quote_note: customerNote.trim() || null,
        pricing_snapshot_id: projection.id,
        pricing_rule_id: pricing.pricing_rule_id,
        pricing_rule_name: projection.rule?.name ?? null,
        gross_profit: pricing.gross_profit,
        gross_margin_percent: pricing.gross_margin_percent,
        approved_by_name: approval?.approved_by_name ?? null,
        approved_by_email: approval?.approved_by_email ?? null,
        commercial_version_id: version.id,
        commercial_fingerprint: version.fingerprint,
        commercial_snapshot: version.snapshot,
        commercial_locked: true,
        assigned_to: actor.name,
        assigned_to_name: actor.name,
        assigned_to_email: actor.email,
        created_at: now,
        updated_at: now,
      });
      transaction.update(orderRef, { pricing_status: "quoted", quoted_reference: reference, quoted_commercial_version_id: version.id, quoted_commercial_fingerprint: version.fingerprint, updated_at: now });
      transaction.update(customerSnapshot.ref, { quote_count: FieldValue.increment(1), lead_stage: "quote_sent", updated_at: now });
      transaction.create(eventRef, commercialEventPayload(version, "quote_bound_to_commercial_version", actor, `${reference} · ${pricing.sell_currency} ${pricing.sell_amount.toFixed(decimals)}`));
      transaction.create(customerSnapshot.ref.collection("activity").doc(childId("activity")), {
        type: "quote_created", title: `TMS customer quote created: ${reference}`,
        detail: `${text(order.get("origin"))} → ${text(order.get("destination"))} · ${pricing.sell_currency} ${pricing.sell_amount.toFixed(decimals)}`,
        commercial_version_id: version.id, commercial_fingerprint: version.fingerprint,
        actor_name: actor.name, actor_email: actor.email, created_at: now,
      });
      return { kind: "quoted" as const, quoteReference: reference, preview: projection, idempotent: false };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}
