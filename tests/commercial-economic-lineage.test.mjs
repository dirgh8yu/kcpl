import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMERCIAL_VERSION_SCHEMA,
  commercialApprovalSatisfied,
  commercialFingerprint,
  commercialFingerprintPayload,
  commercialMoney,
  commercialSnapshotIntegrity,
  commercialVersionBookable,
  deriveConsolidationAllocationSnapshot,
  deriveCounterofferSnapshot,
} from "../app/admin/commercial-lineage/commercial-lineage.ts";
import { commercialMutationLockDecision } from "../app/admin/commercial-lineage/commercial-mutation-policy.ts";
import { commercialProfitabilityFromFacts } from "../app/admin/commercial-lineage/commercial-profitability.ts";
import { quoteEconomicEditDecision } from "../app/admin/commercial-lineage/quote-commercial-policy.ts";
import { resolveBookedCommercialLineage } from "../app/admin/financial-settlement/settlement-policy.ts";
import { consolidatedBookingRetryDecision } from "../app/admin/consolidation/tms-consolidation.ts";
import { bookingRetryDecision } from "../app/admin/tenders/tms-tendering.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(join(root, path), "utf8");
const lineageServer = source("app/admin/commercial-lineage/commercial-lineage.server.ts");
const ratingServer = source("app/admin/rating/tms-rating.server.ts");
const pricingServer = source("app/admin/pricing/tms-pricing.server.ts");
const pricingRoute = source("app/api/admin/pricing/route.ts");
const quoteRoute = source("app/api/admin/quotes/[reference]/route.ts");
const tenderServer = source("app/admin/tenders/tms-tendering.server.ts");
const tenderRoute = source("app/api/admin/tenders/route.ts");
const bookingDispatcher = source("app/admin/tenders/tms-booking-lineage-dispatch.server.ts");
const consolidationLineage = source("app/admin/consolidation/tms-consolidation-lineage.server.ts");
const freightAuditServer = source("app/admin/freight-audit/freight-audit.server.ts");
const settlementServer = source("app/admin/financial-settlement/payables-settlement.server.ts");
const financeServer = source("app/admin/finance/finance.server.ts");

function baseSnapshot(overrides = {}) {
  const base = {
    schema_version: COMMERCIAL_VERSION_SCHEMA,
    order_id: "ORD-1",
    branch: "Kathmandu",
    customer_id: "CUST-1",
    mode: "road",
    procurement: {
      rate_card_id: "RC-1",
      rate_card_updated_at: "2026-08-01T00:00:00.000Z",
      rate_card_valid_from: "2026-08-01",
      rate_card_valid_until: "2026-08-31",
      partner_id: "PARTNER-1",
      partner_name: "Carrier One",
      mode: "road",
      service: "standard",
      equipment: "truck",
      rating_unit: "flat",
      rating_quantity: 1,
      base_rate: 1000,
      base_charge: 1000,
      minimum_charge: null,
      minimum_applied: false,
      fuel_surcharge_percent: 0,
      fuel_surcharge: 0,
      accessorials: 0,
      total: 1000,
      currency: "USD",
    },
    pricing: {
      customer_id: "CUST-1",
      pricing_rule_id: "RULE-1",
      pricing_rule_scope: "customer",
      markup_percent: 30,
      target_margin_percent: null,
      minimum_margin_percent: 10,
      approval_below_margin_percent: 12,
      accessorial_cost: 0,
      accessorial_markup_percent: 15,
      fixed_markup: 0,
      discount: 0,
      converted_buy_cost: 1000,
      accessorial_sell: 0,
      pre_discount_sell: 1300,
      sell_amount: 1300,
      sell_currency: "USD",
      gross_profit: 300,
      gross_margin_percent: 23.076923,
      effective_markup_percent: 30,
      minimum_sell_price: 1111.11,
      approval_required: false,
      approval_reasons: [],
    },
    fx: {
      source_currency: "USD",
      target_currency: "USD",
      rate: 1,
      source: "same_currency",
      effective_date: null,
      published_on: null,
      modified_on: null,
      source_npr_per_unit: null,
      target_npr_per_unit: null,
    },
    negotiation: null,
  };
  return {
    ...base,
    ...overrides,
    procurement: { ...base.procurement, ...(overrides.procurement ?? {}) },
    pricing: overrides.pricing === null ? null : { ...base.pricing, ...(overrides.pricing ?? {}) },
    fx: overrides.fx === null ? null : { ...base.fx, ...(overrides.fx ?? {}) },
  };
}

function version(id, snapshot = baseSnapshot()) {
  return { id, fingerprint: commercialFingerprint(snapshot), snapshot };
}

function approvalFor(v) {
  return {
    commercial_version_id: v.id,
    commercial_fingerprint: v.fingerprint,
    order_id: v.snapshot.order_id,
    status: "approved",
    approved_at: "2026-08-23T00:00:00.000Z",
    approved_by_name: "Manager",
    approved_by_email: "manager@kcpl.test",
    note: null,
  };
}

function bookedShipment(snapshot = baseSnapshot(), id = "CV-1") {
  const fingerprint = commercialFingerprint(snapshot);
  return {
    booked_commercial_version_id: id,
    booked_commercial_fingerprint: fingerprint,
    booked_commercial_snapshot: snapshot,
    transport_order_id: snapshot.order_id,
    partner_id: snapshot.procurement.partner_id,
    procurement_cost: snapshot.procurement.total,
    procurement_currency: snapshot.procurement.currency,
    tender_id: "TND-1",
    procurement_rate_card_id: snapshot.procurement.rate_card_id,
  };
}

function walk(path) {
  const out = [];
  for (const name of readdirSync(path)) {
    const full = join(path, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

test("1 canonical fingerprint is deterministic for identical economics", () => {
  const a = baseSnapshot();
  const b = structuredClone(a);
  assert.deepEqual(commercialFingerprintPayload(a), commercialFingerprintPayload(b));
  assert.equal(commercialFingerprint(a), commercialFingerprint(b));
});

test("2 irrelevant metadata, actor, UI notes and display labels do not change fingerprint", () => {
  const a = baseSnapshot();
  const b = { ...structuredClone(a), updated_at: "2099-01-01", actor: "someone", ui_note: "changed", procurement: { ...a.procurement, partner_name: "New Display Label" } };
  assert.equal(commercialFingerprint(a), commercialFingerprint(b));
});

test("3 buy amount and buy currency change fingerprint", () => {
  const original = commercialFingerprint(baseSnapshot());
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ procurement: { total: 1000.01 } })));
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ procurement: { currency: "NPR" }, fx: null })));
});

test("4 sell amount and sell currency change fingerprint", () => {
  const original = commercialFingerprint(baseSnapshot());
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ pricing: { sell_amount: 1300.01 } })));
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ pricing: { sell_currency: "NPR" }, fx: { target_currency: "NPR", rate: 132 } })));
});

test("5 discount and other margin-relevant pricing inputs change fingerprint", () => {
  const original = commercialFingerprint(baseSnapshot());
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ pricing: { discount: 10 } })));
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ pricing: { markup_percent: 31 } })));
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ pricing: { minimum_margin_percent: 11 } })));
});

test("6 selected rate revision identity changes fingerprint without consulting future rate values", () => {
  const original = commercialFingerprint(baseSnapshot());
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ procurement: { rate_card_updated_at: "2026-08-02T00:00:00.000Z" } })));
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ procurement: { rate_card_id: "RC-2" } })));
});

test("7 FX rate, source and effective decision change fingerprint", () => {
  const npr = baseSnapshot({
    procurement: { total: 1000, currency: "USD" },
    pricing: { converted_buy_cost: 132000, sell_amount: 160000, sell_currency: "NPR", gross_profit: 28000, gross_margin_percent: 17.5, effective_markup_percent: 21.212121, minimum_sell_price: 146666.67 },
    fx: { source_currency: "USD", target_currency: "NPR", rate: 132, source: "nrb", effective_date: "2026-08-01", published_on: "2026-08-01", modified_on: null, source_npr_per_unit: 132, target_npr_per_unit: 1 },
  });
  const original = commercialFingerprint(npr);
  assert.notEqual(original, commercialFingerprint({ ...npr, fx: { ...npr.fx, rate: 132.1 } }));
  assert.notEqual(original, commercialFingerprint({ ...npr, fx: { ...npr.fx, source: "manual" } }));
  assert.notEqual(original, commercialFingerprint({ ...npr, fx: { ...npr.fx, effective_date: "2026-08-02" } }));
});

test("8 customer contract scope changes fingerprint", () => {
  const original = commercialFingerprint(baseSnapshot());
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ customer_id: "CUST-2", pricing: { customer_id: "CUST-2" } })));
  assert.notEqual(original, commercialFingerprint(baseSnapshot({ pricing: { pricing_rule_id: "RULE-2" } })));
});

test("9 money normalization is deterministic for floating edges, zero and large values", () => {
  assert.equal(commercialMoney(0.1 + 0.2, "USD"), 0.3);
  assert.equal(commercialMoney(0, "USD"), 0);
  assert.equal(commercialMoney(999999999999.994, "USD"), 999999999999.99);
  assert.equal(commercialMoney(12.6, "JPY"), 13);
});

test("10 invalid NaN infinity and prohibited negative commercial totals fail integrity", () => {
  assert.equal(commercialSnapshotIntegrity(baseSnapshot({ procurement: { total: Number.NaN } })).ok, false);
  assert.equal(commercialSnapshotIntegrity(baseSnapshot({ procurement: { total: Number.POSITIVE_INFINITY } })).ok, false);
  assert.equal(commercialSnapshotIntegrity(baseSnapshot({ procurement: { total: -1 } })).ok, false);
  assert.equal(commercialSnapshotIntegrity(baseSnapshot({ pricing: { sell_amount: -1 } })).ok, false);
});

test("11 stored FX rate reproduces the stored converted amount to commercial money precision", () => {
  const sourceAmount = 1234.56;
  const rate = 132.123456789012;
  const converted = commercialMoney(sourceAmount * rate, "NPR");
  const snapshot = baseSnapshot({
    procurement: { total: sourceAmount, currency: "USD" },
    pricing: { converted_buy_cost: converted, sell_amount: 180000, sell_currency: "NPR", gross_profit: commercialMoney(180000 - converted, "NPR"), gross_margin_percent: 8, effective_markup_percent: 9, minimum_sell_price: 170000 },
    fx: { source_currency: "USD", target_currency: "NPR", rate, source: "manual", effective_date: "2026-08-01", published_on: null, modified_on: null, source_npr_per_unit: null, target_npr_per_unit: null },
  });
  assert.equal(commercialMoney(snapshot.procurement.total * snapshot.fx.rate, snapshot.pricing.sell_currency), snapshot.pricing.converted_buy_cost);
});

test("12 approval attestation binds exact ID fingerprint and order, never a transport order generally", () => {
  const v1 = version("CV-1", baseSnapshot({ pricing: { approval_required: true } }));
  const approval = approvalFor(v1);
  assert.equal(commercialApprovalSatisfied(v1, approval), true);
  const v2 = version("CV-2", baseSnapshot({ pricing: { approval_required: true, discount: 20, sell_amount: 1280 } }));
  assert.equal(commercialApprovalSatisfied(v2, approval), false);
});

test("13 approval for V1 cannot make derived V2 bookable", () => {
  const v1 = version("CV-1", baseSnapshot({ pricing: { approval_required: true } }));
  const v2 = version("CV-2", baseSnapshot({ pricing: { approval_required: true, discount: 50, sell_amount: 1250 } }));
  assert.equal(commercialVersionBookable(v1, approvalFor(v1)).ok, true);
  assert.deepEqual(commercialVersionBookable(v2, approvalFor(v1)).reason, "approval_required");
});

test("14 counteroffer derives new procurement truth, preserves customer sell and re-evaluates margin", () => {
  const base = baseSnapshot();
  const next = deriveCounterofferSnapshot(base, 1200, "USD");
  assert.equal(base.procurement.total, 1000);
  assert.equal(next.procurement.total, 1200);
  assert.equal(next.pricing.sell_amount, 1300);
  assert.equal(next.pricing.converted_buy_cost, 1200);
  assert.ok(next.pricing.gross_margin_percent < 12);
  assert.equal(next.pricing.approval_required, true);
  assert.notEqual(commercialFingerprint(next), commercialFingerprint(base));
});

test("15 policy-valid counteroffer can remain bookable without mandatory approval", () => {
  const next = deriveCounterofferSnapshot(baseSnapshot(), 1050, "USD");
  assert.equal(next.pricing.sell_amount, 1300);
  assert.equal(next.pricing.approval_required, false);
  const v = version("CV-C", next);
  assert.equal(commercialVersionBookable(v, null).ok, true);
});

test("16 currency-changing counteroffer without historical matching FX fails into explicit review state", () => {
  const next = deriveCounterofferSnapshot(baseSnapshot(), 120000, "NPR");
  assert.equal(next.fx, null);
  assert.equal(next.pricing.converted_buy_cost, null);
  assert.equal(next.pricing.approval_required, true);
  assert.match(next.pricing.approval_reasons.join(" "), /FX decision is required/i);
  assert.equal(commercialSnapshotIntegrity(next).ok, false);
});

test("17 acceptance at the offered economics is wired to retain the existing version", () => {
  const acceptedStart = tenderServer.indexOf('if (input.status === "accepted")');
  const counterStart = tenderServer.indexOf("const counterCost =", acceptedStart);
  assert.ok(acceptedStart >= 0 && counterStart > acceptedStart);
  const acceptedBranch = tenderServer.slice(acceptedStart, counterStart);
  assert.match(acceptedBranch, /final_commercial_version_id: baseVersion\.id/);
  assert.match(acceptedBranch, /final_commercial_fingerprint: baseVersion\.fingerprint/);
  assert.doesNotMatch(acceptedBranch, /newCommercialVersion/);
});

test("18 no-economic-change counteroffer also avoids meaningless commercial version churn", () => {
  assert.match(tenderServer, /const sameEconomics[\s\S]{0,1200}final_commercial_version_id: baseVersion\.id/);
  assert.match(tenderServer, /tender_countered_no_economic_change/);
});

test("19 consolidation allocation derives booked procurement without mutating source economics", () => {
  const sourceSnapshot = baseSnapshot();
  const before = structuredClone(sourceSnapshot);
  const allocated = deriveConsolidationAllocationSnapshot(sourceSnapshot, { amount: 800, currency: "USD", partnerId: "MASTER-P", partnerName: "Master Carrier", masterRateCardId: "MASTER-RC", mode: "road" });
  assert.deepEqual(sourceSnapshot, before);
  assert.equal(allocated.procurement.total, 800);
  assert.equal(allocated.procurement.partner_id, "MASTER-P");
  assert.equal(allocated.pricing.sell_amount, sourceSnapshot.pricing.sell_amount);
});

test("20 expected and actual profitability use explicit currencies and never hidden conversion", () => {
  const comparable = commercialProfitabilityFromFacts({
    expectedRevenue: { amount: 1300, currency: "USD" }, expectedProcurement: { amount: 1000, currency: "USD" }, actualProcurement: { amount: 1050, currency: "USD" },
  });
  assert.equal(comparable.expected_profit_amount, 300);
  assert.equal(comparable.actual_profit_amount, 250);
  assert.equal(comparable.expected_comparable, true);
  assert.equal(comparable.actual_comparable, true);
  const cross = commercialProfitabilityFromFacts({
    expectedRevenue: { amount: 1300, currency: "USD" }, expectedProcurement: { amount: 1000, currency: "USD" }, actualProcurement: { amount: 140000, currency: "NPR" },
  });
  assert.equal(cross.actual_comparable, false);
  assert.equal(cross.actual_profit_amount, null);
});

test("21 draft and cancelled-unreleased consolidation state stays mutable; released house is locked", () => {
  assert.equal(commercialMutationLockDecision({ consolidation_load_id: "L1", procurement_locked_by_load: false }), "allowed");
  assert.equal(commercialMutationLockDecision({ consolidation_load_id: null, procurement_locked_by_load: false }), "allowed");
  assert.equal(commercialMutationLockDecision({ consolidation_load_id: "L1", consolidation_master_order_id: "M1", procurement_locked_by_load: true }), "released_consolidation_locked");
  assert.equal(commercialMutationLockDecision({ is_consolidation_master: true, procurement_locked_by_load: true }), "allowed");
});

test("22 versioned TMS quote economic editing is locked while legacy unversioned quote remains on legacy policy", () => {
  assert.equal(quoteEconomicEditDecision({}), "allowed_legacy");
  assert.equal(quoteEconomicEditDecision({ commercial_locked: true }), "locked_versioned");
  assert.equal(quoteEconomicEditDecision({ commercial_version_id: "CV-1", commercial_fingerprint: "fp" }), "locked_versioned");
  assert.equal(quoteEconomicEditDecision({ commercial_version_id: "CV-1" }), "locked_versioned");
});

test("23 versioned quote PATCH is structurally blocked but notes remain a separate non-economic path", () => {
  assert.match(quoteRoute, /assertQuoteEconomicEditAllowed/);
  assert.match(quoteRoute, /VERSIONED_QUOTE_COMMERCIAL_LOCK/);
  assert.match(quoteRoute, /addQuoteNote/);
  assert.match(pricingServer, /commercial_locked: true/);
  assert.match(pricingServer, /quoteReference\(orderRef\.id, expectedId\)/);
});

test("24 repricing creates a separate quote identity and old quote economics are never merge-updated", () => {
  assert.match(pricingServer, /function quoteReference\([^)]*versionId/);
  assert.match(pricingServer, /transaction\.create\(quoteRef/);
  assert.doesNotMatch(pricingServer, /transaction\.set\(quoteRef[\s\S]{0,120}merge:\s*true/);
});

test("25 standard booking retry remains idempotent only for the same operational booking facts", () => {
  const input = {
    requestedBookingReference: "BOOK-1", tenderBookingReference: "BOOK-1", orderBookingReference: "BOOK-1",
    tenderShipmentReference: "S-1", orderShipmentReference: "S-1", shipmentExists: true,
    shipmentOrderId: "ORD-1", expectedOrderId: "ORD-1", shipmentTenderId: "TND-1", expectedTenderId: "TND-1",
    shipmentBookingReference: "BOOK-1", shipmentBranch: "Kathmandu", expectedBranch: "Kathmandu",
    shipmentCustomerId: "CUST-1", expectedCustomerId: "CUST-1", shipmentConsolidationLoadId: null,
  };
  assert.equal(bookingRetryDecision(input), "idempotent");
  assert.equal(bookingRetryDecision({ ...input, requestedBookingReference: "BOOK-2" }), "booking_conflict");
});

test("26 standard booking retry additionally checks exact commercial version across tender order shipment and quote", () => {
  assert.match(tenderServer, /booked_commercial_version_id/);
  assert.match(tenderServer, /existingShipment\.get\("booked_commercial_version_id"\)/);
  assert.match(tenderServer, /bridge\.get\("commercial_version_id"\)/);
  assert.match(tenderServer, /loadCommercialVersionInTransaction/);
});

test("27 consolidated booking retry is deterministic and does not create duplicate lineage versions", () => {
  const base = {
    requestedBookingReference: "BOOK-1", loadBookingReference: "BOOK-1", masterShipmentReference: "M-1",
    memberShipmentReferences: ["S-1", "S-2"], expectedMemberCount: 2, tenderStatus: "booked",
    tenderBookingReference: "BOOK-1", tenderShipmentReference: "M-1", masterOrderStatus: "booked",
    masterOrderBookingReference: "BOOK-1", masterOrderShipmentReference: "M-1",
  };
  assert.equal(consolidatedBookingRetryDecision(base), "idempotent");
  assert.equal(consolidatedBookingRetryDecision({ ...base, memberShipmentReferences: ["S-1", "S-1"] }), "state_conflict");
  assert.match(consolidationLineage, /if \(text\(load\.get\("status"\)\) === "booked"\)/);
  assert.match(consolidationLineage, /return \{ kind: "booked" as const, masterShipmentReference, shipmentReferences: refs, idempotent: true \}/);
});

test("28 released consolidation preserves source version then writes one derived booked allocation per house", () => {
  assert.match(consolidationLineage, /sourceVersions/);
  assert.match(consolidationLineage, /previousVersionId: source\.id, reason: "consolidation_allocation"/);
  assert.match(consolidationLineage, /source_house_commercial_version_id: source\.id/);
  assert.match(consolidationLineage, /persistCommercialVersionInTransaction\(transaction, version\)/);
  assert.match(consolidationLineage, /consolidation_source_commercial_version_id: source\.id/);
  assert.match(consolidationLineage, /commercial_allocations/);
});

test("29 consolidated booking revalidates master and house pricing approval inside its authoritative transaction", () => {
  const transactionStart = consolidationLineage.indexOf("runTransaction");
  const masterApproval = consolidationLineage.indexOf("assertBookableCommercialVersionInTransaction(transaction, masterVersion)");
  const houseApproval = consolidationLineage.indexOf("assertBookableCommercialVersionInTransaction(transaction, source.version)");
  assert.ok(transactionStart >= 0 && masterApproval > transactionStart && houseApproval > transactionStart);
});

test("30 rating and pricing server routes reject released-house economic mutation; tendering already rejects independent house tender/book", () => {
  assert.match(ratingServer, /procurementLockedByConsolidation/);
  assert.match(pricingRoute, /assertOrderCommercialMutationAllowed/);
  assert.match(pricingRoute, /RELEASED_CONSOLIDATION_COMMERCIAL_LOCK/);
  assert.match(tenderServer, /consolidated_order/);
});

test("31 tender creation binds offered economics to immutable version rather than reloading a live rate card", () => {
  assert.match(tenderServer, /resolveCurrentCommercialVersionInTransaction/);
  assert.match(tenderServer, /const procurement = version\.snapshot\.procurement/);
  assert.match(tenderServer, /offered_commercial_version_id: version\.id/);
  assert.doesNotMatch(tenderServer, /collection\("partner_rate_cards"\)/);
});

test("32 quote tender approval and booking graph fails closed on incompatible version pointers", () => {
  assert.match(pricingServer, /pricing_approval_version_id: version\.id/);
  assert.match(pricingServer, /commercial_version_id: version\.id/);
  assert.match(tenderServer, /orderPointer\.id !== version\.id/);
  assert.match(tenderServer, /explicitQuote\.get\("commercial_version_id"\)/);
  assert.match(tenderServer, /booked_commercial_version_id/);
});

test("33 Freight Audit uses immutable booked procurement lineage and contains no mutable rate-card reconstruction", () => {
  assert.match(freightAuditServer, /resolveBookedCommercialLineage/);
  assert.match(freightAuditServer, /lineage\.snapshot\.procurement/);
  assert.doesNotMatch(freightAuditServer, /collection\("partner_rate_cards"\)/);
  assert.doesNotMatch(freightAuditServer, /rateQuantity/);
  assert.match(freightAuditServer, /legacy_unversioned/);
});

test("34 Match-Pay blocks audit shipment order or persisted-version lineage mismatch without changing settlement math", () => {
  assert.match(settlementServer, /audit\.get\("booked_commercial_version_id"\)/);
  assert.match(settlementServer, /order\.get\("booked_commercial_version_id"\)/);
  assert.match(settlementServer, /collection\("commercial_versions"\)/);
  assert.match(settlementServer, /return \{ kind: "audit_stale" as const \}/);
  assert.match(settlementServer, /resolveSettlementBasis/);
  assert.match(settlementServer, /applySettlementPayment/);
});

test("35 a booked lineage fingerprint detects immutable historical snapshot mismatch", () => {
  const shipment = bookedShipment();
  assert.equal(resolveBookedCommercialLineage(shipment).ok, true);
  assert.equal(resolveBookedCommercialLineage({ ...shipment, procurement_cost: 1200 }).reason, "commercial_review_required");
  assert.equal(resolveBookedCommercialLineage({ ...shipment, booked_commercial_fingerprint: "bad" }).reason, "commercial_review_required");
});

test("36 legacy booked records are never reconstructed from today's rate card or FX", () => {
  assert.equal(resolveBookedCommercialLineage({ procurement_cost: 1000, procurement_currency: "USD", procurement_rate_card_id: "RC-1" }).reason, "legacy_unversioned");
  assert.match(lineageServer, /legacy_booked_history_unproven/);
  assert.match(lineageServer, /Booked history is never fabricated from today's rate card or FX/);
});

test("37 unbooked legacy selection may be reconstructed only when current selection projection is exactly provable", () => {
  assert.match(lineageServer, /reconstructLegacySelectedVersion/);
  assert.match(lineageServer, /sameCommercialMoney\(total, selectedCost, selectedCurrency\)/);
  assert.match(lineageServer, /legacy_selected_economics_not_provable/);
  assert.match(lineageServer, /legacy_selected_reconstructed/);
});

test("38 commercial_versions are append-only across supported application source", () => {
  const files = walk(join(root, "app"));
  const joined = files.map((file) => readFileSync(file, "utf8")).filter((body) => body.includes("commercial_versions")).join("\n").replace(/\s+/g, " ");
  assert.match(joined, /transaction\.create\(firebaseAdminDb\(\)\.collection\("commercial_versions"\)\.doc\(version\.id\)/);
  assert.doesNotMatch(joined, /collection\("commercial_versions"\)\.doc\([^)]*\)\.(?:update|delete|set)\(/);
  assert.doesNotMatch(joined, /transaction\.(?:update|delete|set)\([^;]{0,220}collection\("commercial_versions"\)/);
});

test("39 commercial approvals remain separate exact-version append-only attestations and retries are idempotent", () => {
  assert.match(lineageServer, /collection\("commercial_approvals"\)\.doc\(version\.id\)/);
  assert.match(lineageServer, /transaction\.create\(ref, approval\)/);
  assert.match(pricingServer, /const existing = await loadCommercialApprovalInTransaction/);
  assert.match(pricingServer, /idempotent: true/);
  assert.doesNotMatch(lineageServer, /commercial_versions[\s\S]{0,160}approved_by/);
});

test("40 approval versus repricing race contends on authoritative order pointer and cannot transfer approval", () => {
  assert.match(pricingServer, /runTransaction/);
  assert.match(pricingServer, /commercial_version_id/);
  assert.match(pricingServer, /expectedId/);
  assert.match(pricingServer, /stale_commercial_state/);
  assert.match(pricingServer, /persistCommercialVersionInTransaction\(transaction, version\)/);
});

test("41 tender versus repricing and booking versus repricing races share the order document contention point", () => {
  assert.match(tenderServer, /const order = await transaction\.get\(orderRef\)/);
  assert.match(tenderServer, /orderPointer/);
  assert.match(pricingServer, /const orderSnapshot = await transaction\.get\(orderRef\)/);
  assert.match(pricingServer, /transaction\.update\(orderRef/);
});

test("42 counteroffer versus V1 approval cannot transfer approval to derived V2", () => {
  assert.match(tenderServer, /commercialOrderPointer\(nextVersion/);
  assert.match(lineageServer, /pricing_approval_status: approvalStatus/);
  assert.match(lineageServer, /pricing_approval_version_id: approvalStatus === "approved" \? version\.id : null/);
  assert.match(lineageServer, /pricing_approval_fingerprint: approvalStatus === "approved" \? version\.fingerprint : null/);
  assert.match(tenderServer, /counteroffer_commercial_version_created/);
  assert.match(pricingServer, /projection\.commercial_version_id !== version\.id/);
});

test("43 Freight Audit refresh and payment both fingerprint the same booked lineage, so a correction race becomes stale", () => {
  assert.match(freightAuditServer, /freightAuditEconomicFingerprint/);
  assert.match(settlementServer, /freightAuditEconomicFingerprint/);
  assert.match(settlementServer, /auditFingerprint === currentFingerprint/);
});

test("44 released-house repricing and consolidation booking contend on the locked order and exact source pointer", () => {
  assert.match(pricingRoute, /assertOrderCommercialMutationAllowed/);
  assert.match(consolidationLineage, /procurement_locked_by_load/);
  assert.match(consolidationLineage, /order\.get\("commercial_version_id"\)/);
  assert.match(consolidationLineage, /order\.get\("commercial_fingerprint"\)/);
});

test("45 booking dispatcher leaves no supported admin route on the old non-lineage consolidated booking path", () => {
  assert.match(tenderRoute, /confirmTmsTenderBookingWithCommercialLineage/);
  assert.doesNotMatch(tenderRoute, /confirmConsolidatedLoadBooking\(/);
  assert.match(bookingDispatcher, /confirmConsolidatedLoadBookingWithLineage/);
  assert.match(bookingDispatcher, /return confirmTmsTenderBooking\(tenderId, input, actor, staff\)/);
});

test("46 expected profitability integration verifies booked snapshot and matching validated Freight Audit rather than current rate pricing or FX", () => {
  assert.match(financeServer, /customerCommercialProfitabilitySummary/);
  const profitabilityServer = source("app/admin/commercial-lineage/commercial-profitability.server.ts");
  assert.match(profitabilityServer, /resolveBookedCommercialLineage\(shipmentData\)/);
  assert.match(profitabilityServer, /lineage\.snapshot\.pricing\?\.sell_amount/);
  assert.match(profitabilityServer, /lineage\.snapshot\.procurement\.total/);
  assert.match(profitabilityServer, /booked_commercial_version_id/);
  assert.match(profitabilityServer, /booked_commercial_fingerprint/);
  assert.match(profitabilityServer, /value\.versionId === lineage\.versionId && value\.fingerprint === lineage\.fingerprint/);
  assert.match(profitabilityServer, /matched/);
  assert.match(profitabilityServer, /approved_variance/);
  assert.doesNotMatch(profitabilityServer, /partner_rate_cards|pricing_rules|getNrbForexSnapshot|fxRate|convertCurrency/);
});

test("47 PR #126 Match-Pay protections remain transactionally present", () => {
  assert.match(settlementServer, /supplierInvoiceUniquenessKey|supplier_invoice_uniques/);
  assert.match(settlementServer, /paymentDocumentId/);
  assert.match(settlementServer, /transaction\.create\(paymentRef/);
  assert.match(settlementServer, /freightAuditPaymentAllowed/);
  assert.match(settlementServer, /currency_mismatch/);
  assert.match(settlementServer, /overpayment/);
});

test("48 PR #127 one-active-tender exactly-once booking and consolidated atomicity remain present", () => {
  assert.match(tenderServer, /activeTenderDocsInTransaction/);
  assert.match(tenderServer, /resolveTenderAuthority/);
  assert.match(tenderServer, /bookingRetryDecision/);
  assert.match(consolidationLineage, /runTransaction/);
  assert.match(consolidationLineage, /MAX_LOAD_ORDERS/);
});

test("49 PR #128 authorization and same-origin trust boundaries remain on the economic routes", () => {
  assert.match(pricingRoute, /getStaffContext/);
  assert.match(pricingRoute, /isTrustedSameOriginRequest/);
  assert.match(quoteRoute, /checkQuoteBranchAccess/);
  assert.match(quoteRoute, /isTrustedSameOriginRequest/);
  assert.match(tenderRoute, /getStaffContext/);
  assert.match(tenderRoute, /isTrustedSameOriginRequest/);
});