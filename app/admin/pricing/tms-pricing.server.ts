import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
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

type PricingOverrides = {
  sellCurrency?: CrmCurrency | null;
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
  approval_status: "not_required" | "pending" | "approved" | "rejected";
  calculated_at: string;
  calculated_by_name: string;
  calculated_by_email: string;
  approved_at: string | null;
  approved_by_name: string | null;
  approved_by_email: string | null;
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
function quoteReference(orderId: string) { return `TMSSELL-${orderId.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }

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

async function getOrder(orderId: string) {
  const id = orderId.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("transport_orders").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const order = orderCandidateFromData(snapshot.id, data);
  return order ? { ref, snapshot, data, order } : null;
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
  const rules = snapshot.docs
    .map((doc) => pricingRuleFromData(doc.id, doc.data() as Record<string, unknown>))
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
  const orders = orderSnapshot.docs
    .map((doc) => orderCandidateFromData(doc.id, doc.data() as Record<string, unknown>))
    .filter((order): order is PricingOrderCandidate => Boolean(order))
    .filter((order) => staffCanAccessBranch(staff, order.branch));
  const customerIds = [...new Set(orders.flatMap((order) => order.customer_id ? [order.customer_id] : []))];
  const customerSnapshots = customerIds.length ? await firebaseAdminDb().getAll(...customerIds.map((id) => firebaseAdminDb().collection("customers").doc(id))) : [];
  const customers = customerSnapshots
    .filter((snapshot) => snapshot.exists)
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
    name: input.name.trim() || id,
    active: input.active,
    priority: Math.trunc(input.priority || 0),
    scope: input.scope,
    branch: input.branch || null,
    customer_id: customerId,
    origin: input.origin?.trim() || null,
    destination: input.destination?.trim() || null,
    mode: input.mode || null,
    sell_currency: input.sellCurrency || null,
    markup_percent: input.markupPercent ?? null,
    target_margin_percent: input.targetMarginPercent ?? null,
    minimum_margin_percent: input.minimumMarginPercent,
    accessorial_markup_percent: input.accessorialMarkupPercent,
    fixed_markup: input.fixedMarkup,
    approval_below_margin_percent: input.approvalBelowMarginPercent,
    notes: input.notes?.trim() || null,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };
  await firebaseAdminDb().collection("pricing_rules").doc(id).create(data);
  return { kind: "created" as const, rule: pricingRuleFromData(id, data)! };
}

export async function calculateOrderPricing(orderId: string, overrides: PricingOverrides, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getOrder(orderId);
  if (!record) return { kind: "missing_order" as const };
  if (!staffCanAccessBranch(staff, record.order.branch)) return { kind: "forbidden" as const };
  if (!record.order.customer_id) return { kind: "customer_required" as const };
  if (["cancelled"].includes(record.order.status)) return { kind: "locked" as const };
  const customerRecord = await getCustomer(record.order.customer_id);
  if (!customerRecord) return { kind: "customer_missing" as const };
  const rulesResult = await listPricingRules(staff);
  if (rulesResult.kind !== "ready") return rulesResult;
  const rule = resolvePricingRule(rulesResult.rules, record.order);
  const defaults = rulePricingDefaults(rule, customerRecord.customer.markup_percent);
  const sellCurrency = overrides.sellCurrency ?? rule?.sell_currency ?? customerRecord.customer.preferred_currency ?? record.order.buy_currency;
  if (!crmCurrencies.includes(sellCurrency)) return { kind: "invalid_currency" as const };
  const fxRate = record.order.buy_currency === sellCurrency ? 1 : overrides.fxRate ?? 0;
  if (!Number.isFinite(fxRate) || fxRate <= 0) return { kind: "fx_required" as const, buyCurrency: record.order.buy_currency, sellCurrency };

  const pricingInput: PricingInput = {
    buy_cost: record.order.buy_cost,
    buy_currency: record.order.buy_currency,
    sell_currency: sellCurrency,
    fx_rate: fxRate,
    markup_percent: overrides.markupPercent ?? defaults.markup_percent,
    target_margin_percent: overrides.targetMarginPercent ?? defaults.target_margin_percent,
    minimum_margin_percent: overrides.minimumMarginPercent ?? defaults.minimum_margin_percent,
    approval_below_margin_percent: overrides.approvalBelowMarginPercent ?? defaults.approval_below_margin_percent,
    accessorial_cost: Math.max(0, overrides.accessorialCost ?? 0),
    accessorial_markup_percent: overrides.accessorialMarkupPercent ?? defaults.accessorial_markup_percent,
    fixed_markup: overrides.fixedMarkup ?? defaults.fixed_markup,
    discount: Math.max(0, overrides.discount ?? 0),
  };
  let result;
  try { result = calculateSellPrice(pricingInput); }
  catch { return { kind: "invalid_pricing" as const }; }
  if (!Number.isFinite(result.sell_price) || !Number.isFinite(result.minimum_sell_price)) return { kind: "invalid_pricing" as const };

  const now = new Date().toISOString();
  const snapshot: StoredPricingSnapshot = {
    id: pricingSnapshotId(),
    order: record.order,
    customer: customerRecord.customer,
    rule,
    input: pricingInput,
    result,
    approval_status: result.approval_required ? "pending" : "not_required",
    calculated_at: now,
    calculated_by_name: actor.name,
    calculated_by_email: actor.email,
    approved_at: null,
    approved_by_name: null,
    approved_by_email: null,
  };
  const batch = firebaseAdminDb().batch();
  batch.update(record.ref, {
    pricing_status: result.approval_required ? "approval_required" : "priced",
    pricing_snapshot: snapshot,
    quoted_reference: null,
    updated_at: now,
  });
  batch.create(record.ref.collection("events").doc(childId("evt")), {
    type: result.approval_required ? "sell_price_approval_required" : "sell_price_calculated",
    title: result.approval_required ? "Sell price requires approval" : "Sell price calculated",
    detail: `${sellCurrency} ${result.sell_price.toFixed(2)} · margin ${result.gross_margin_percent.toFixed(2)}%${rule ? ` · ${rule.name}` : " · customer/default pricing"}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: result.approval_required ? "approval_required" as const : "priced" as const, preview: snapshot };
}

export async function approveOrderPricing(orderId: string, note: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (staff.permissions.role !== "management") return { kind: "forbidden" as const };
  const record = await getOrder(orderId);
  if (!record) return { kind: "missing_order" as const };
  if (!staffCanAccessBranch(staff, record.order.branch)) return { kind: "forbidden" as const };
  const raw = record.data.pricing_snapshot;
  if (!raw || typeof raw !== "object") return { kind: "pricing_required" as const };
  const snapshot = raw as StoredPricingSnapshot;
  if (!snapshot.result?.approval_required) return { kind: "not_required" as const };
  if (snapshot.approval_status === "approved") return { kind: "approved" as const, preview: snapshot };
  const now = new Date().toISOString();
  const approved: StoredPricingSnapshot = { ...snapshot, approval_status: "approved", approved_at: now, approved_by_name: actor.name, approved_by_email: actor.email };
  const batch = firebaseAdminDb().batch();
  batch.update(record.ref, { pricing_status: "priced", pricing_snapshot: approved, updated_at: now });
  batch.create(record.ref.collection("events").doc(childId("evt")), { type: "sell_price_approved", title: "Sell price approved by Management", detail: note.trim() || approved.result.approval_reasons.join(" "), actor_name: actor.name, actor_email: actor.email, created_at: now });
  await batch.commit();
  return { kind: "approved" as const, preview: approved };
}

export async function createQuoteFromOrderPricing(orderId: string, validUntil: string | null, customerNote: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const record = await getOrder(orderId);
  if (!record) return { kind: "missing_order" as const };
  if (!staffCanAccessBranch(staff, record.order.branch)) return { kind: "forbidden" as const };
  if (!record.order.customer_id) return { kind: "customer_required" as const };
  const customerRecord = await getCustomer(record.order.customer_id);
  if (!customerRecord) return { kind: "customer_missing" as const };
  const raw = record.data.pricing_snapshot;
  if (!raw || typeof raw !== "object") return { kind: "pricing_required" as const };
  const snapshot = raw as StoredPricingSnapshot;
  if (!snapshot.result || !snapshot.input || snapshot.order?.id !== record.order.id) return { kind: "pricing_required" as const };
  if (snapshot.result.approval_required && snapshot.approval_status !== "approved") return { kind: "approval_required" as const };
  const date = validUntil?.trim() || "";
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "invalid_validity" as const };

  const reference = quoteReference(record.order.id);
  const quoteRef = firebaseAdminDb().collection("quotes").doc(reference);
  const existing = await quoteRef.get();
  const now = new Date().toISOString();
  const baseCost = snapshot.result.converted_buy_cost + Math.max(0, snapshot.input.accessorial_cost);
  const decimals = snapshot.input.sell_currency === "JPY" ? 0 : 2;
  const batch = firebaseAdminDb().batch();
  batch.set(quoteRef, {
    reference,
    status: "quoted",
    source: "tms_sell_pricing_engine",
    migration_hidden: false,
    transport_order_id: record.order.id,
    customer_id: customerRecord.customer.id,
    company_name: customerRecord.customer.display_name,
    contact_name: "",
    contact_email: text(customerRecord.snapshot.get("primary_email")),
    phone: text(customerRecord.snapshot.get("primary_phone")),
    origin: record.order.origin,
    destination: record.order.destination,
    mode: record.order.mode,
    cargo_type: "",
    quote_currency: snapshot.input.sell_currency,
    quoted_amount: snapshot.result.sell_price.toFixed(decimals),
    internal_cost: baseCost.toFixed(decimals),
    valid_until: date || null,
    customer_quote_note: customerNote.trim() || null,
    pricing_snapshot_id: snapshot.id,
    pricing_rule_id: snapshot.rule?.id ?? null,
    pricing_rule_name: snapshot.rule?.name ?? null,
    gross_profit: snapshot.result.gross_profit,
    gross_margin_percent: snapshot.result.gross_margin_percent,
    approved_by_name: snapshot.approved_by_name,
    approved_by_email: snapshot.approved_by_email,
    assigned_to: actor.name,
    assigned_to_name: actor.name,
    assigned_to_email: actor.email,
    created_at: existing.exists ? text(existing.get("created_at"), now) : now,
    updated_at: now,
  }, { merge: true });
  batch.update(record.ref, { pricing_status: "quoted", quoted_reference: reference, updated_at: now });
  batch.create(record.ref.collection("events").doc(childId("evt")), { type: "customer_quote_created", title: `Customer quote ${reference} created`, detail: `${snapshot.input.sell_currency} ${snapshot.result.sell_price.toFixed(decimals)} · margin ${snapshot.result.gross_margin_percent.toFixed(2)}%`, actor_name: actor.name, actor_email: actor.email, created_at: now });
  if (!existing.exists) batch.update(customerRecord.ref, { quote_count: FieldValue.increment(1), lead_stage: "quote_sent", updated_at: now });
  batch.create(customerRecord.ref.collection("activity").doc(childId("activity")), { type: "quote_created", title: `TMS customer quote created: ${reference}`, detail: `${record.order.origin} → ${record.order.destination} · ${snapshot.input.sell_currency} ${snapshot.result.sell_price.toFixed(decimals)}`, actor_name: actor.name, actor_email: actor.email, created_at: now });
  await batch.commit();
  return { kind: "quoted" as const, quoteReference: reference, preview: snapshot };
}
