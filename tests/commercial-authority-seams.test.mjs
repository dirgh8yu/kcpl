import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMERCIAL_APPROVAL_BELOW_MARGIN_PERCENT,
  COMMERCIAL_MINIMUM_MARGIN_PERCENT,
  COMMERCIAL_POLICY_ID,
  customerSellEconomicsMatch,
  quoteHasTmsAuthorityMarkers,
  tmsCustomerQuoteReference,
} from "../app/admin/commercial-authority/commercial-authority.ts";
import { COMMERCIAL_VERSION_SCHEMA, commercialFingerprint } from "../app/admin/commercial-lineage/commercial-lineage.ts";
import { rateCardAppliesToOrder } from "../app/admin/rating/tms-rating.ts";
import { staffCapabilitiesForRole } from "../app/admin/staff-permissions.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(join(root, path), "utf8");
const quoteRoute = source("app/api/admin/quotes/[reference]/route.ts");
const adminData = source("app/admin/admin-data.server.ts");
const shipmentServer = source("app/shipment-data.server.ts");
const customerAuthority = source("app/admin/commercial-authority/customer-sell-authority.server.ts");
const pricingRoute = source("app/api/admin/pricing/route.ts");
const pricingServer = source("app/admin/pricing/tms-pricing.server.ts");
const tenderServer = source("app/admin/tenders/tms-tendering.server.ts");
const consolidation = source("app/admin/consolidation/tms-consolidation-lineage.server.ts");
const lineageServer = source("app/admin/commercial-lineage/commercial-lineage.server.ts");
const ratingServer = source("app/admin/rating/tms-rating.server.ts");
const tenderRoute = source("app/api/admin/tenders/route.ts");
const packageJson = JSON.parse(source("package.json"));

function commercialSnapshot(overrides = {}) {
  const base = {
    schema_version: COMMERCIAL_VERSION_SCHEMA,
    order_id: "ORD-1",
    branch: "Kathmandu",
    customer_id: "CUST-1",
    mode: "road",
    procurement: {
      rate_card_id: "RATE-1",
      rate_card_branch: "Kathmandu",
      rate_card_origin: "Kathmandu",
      rate_card_destination: "Birgunj",
      rate_card_updated_at: "2026-08-23T00:00:00.000Z",
      rate_card_valid_from: null,
      rate_card_valid_until: null,
      partner_id: "PARTNER-1",
      partner_name: "Partner",
      mode: "road",
      service: null,
      equipment: null,
      rating_unit: "flat",
      rating_quantity: 1,
      base_rate: 100,
      base_charge: 100,
      minimum_charge: null,
      minimum_applied: false,
      fuel_surcharge_percent: 0,
      fuel_surcharge: 0,
      accessorials: 0,
      total: 100,
      currency: "NPR",
    },
    pricing: {
      customer_id: "CUST-1",
      pricing_rule_id: null,
      pricing_rule_scope: null,
      pricing_policy_id: COMMERCIAL_POLICY_ID,
      markup_percent: 20,
      target_margin_percent: null,
      minimum_margin_percent: COMMERCIAL_MINIMUM_MARGIN_PERCENT,
      approval_below_margin_percent: COMMERCIAL_APPROVAL_BELOW_MARGIN_PERCENT,
      accessorial_cost: 0,
      accessorial_markup_percent: 15,
      fixed_markup: 0,
      discount: 0,
      converted_buy_cost: 100,
      accessorial_sell: 0,
      pre_discount_sell: 120,
      sell_amount: 120,
      sell_currency: "NPR",
      gross_profit: 20,
      gross_margin_percent: 16.666667,
      effective_markup_percent: 20,
      minimum_sell_price: 111.11,
      approval_required: false,
      approval_reasons: [],
    },
    fx: {
      source_currency: "NPR",
      target_currency: "NPR",
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

function order(branch = "Kathmandu") {
  return {
    id: "ORD-1", branch, customer_id: "CUST-1", customer_name: "Customer", origin: "Kathmandu", destination: "Birgunj", mode: "road",
    pickup_date: "2026-08-23", delivery_date: null, weight_kg: 100, volume_cbm: 1, pieces: 1, container_count: 0, equipment: null,
    temperature_requirement: null, carrier_requirement: null, notes: null, status: "selected", selected_rate_card_id: null, selected_partner_id: null,
    selected_cost: null, selected_currency: null, created_at: "", created_by_name: "", created_by_email: "", updated_at: "",
  };
}

function card(branch = "Kathmandu") {
  return {
    id: "RATE-1", partner_id: "P-1", partner_name: "Partner", branch, origin: "Kathmandu", destination: "Birgunj", mode: "road", service: null,
    equipment: null, currency: "NPR", rate: 100, unit: "flat", minimum_charge: null, fuel_surcharge_percent: 0, accessorial_flat: 0,
    transit_days_min: null, transit_days_max: null, valid_from: null, valid_until: null, active: true, notes: null, created_at: "", updated_at: "",
  };
}

// FSA2-001
test("1 stale V1 TMS quote acceptance rereads current order commercial pointer", () => {
  assert.match(customerAuthority, /transaction\.get\(orderRef\)/);
  assert.match(customerAuthority, /commercial_version_id[\s\S]*versionId[\s\S]*commercial_fingerprint[\s\S]*fingerprint[\s\S]*stale_commercial_quote/);
});
test("2 TMS quote Won cannot use generic shipment creation", () => {
  assert.match(quoteRoute, /status === "won" && !acceptedTmsQuote/);
  assert.match(shipmentServer, /quoteHasTmsAuthorityMarkers\(data\)[\s\S]*tms-authority-required/);
});
test("3 GET quote cannot create a shipment", () => {
  assert.doesNotMatch(adminData, /ensureShipmentForWonQuote/);
  assert.match(adminData, /getShipmentForQuote/);
});
test("4 direct generic shipment helper fails closed on TMS markers", () => {
  assert.match(shipmentServer, /if \(quoteHasTmsAuthorityMarkers\(data\)\) return \{ kind: "tms-authority-required"/);
});
test("5 non-TMS legacy quote explicit shipment mutation is preserved", () => {
  assert.match(quoteRoute, /ensureShipmentForWonQuote\(reference/);
  assert.match(shipmentServer, /if \(data\.status !== "won"\) return \{ kind: "not-won"/);
});
test("6 current TMS customer acceptance is deterministic and idempotent", () => {
  assert.equal(tmsCustomerQuoteReference("ORD-1", "CV-1"), "TMSSELL-ORD-1-CV-1");
  assert.match(customerAuthority, /commercial_customer_acceptances/);
  assert.match(customerAuthority, /idempotent: true/);
});
test("7 durable facts classify TMS quotes without caller isTms flag", () => {
  assert.equal(quoteHasTmsAuthorityMarkers({ transport_order_id: "ORD-1", commercial_version_id: "CV-1" }), true);
  assert.equal(quoteHasTmsAuthorityMarkers({ source: "tms_order_booking_bridge" }), true);
  assert.equal(quoteHasTmsAuthorityMarkers({ source: "legacy_web_quote" }), false);
});
test("8 TMS quote economics cannot be rewritten through generic quote API", () => {
  assert.match(adminData, /quoteHasTmsAuthorityMarkers[\s\S]*return \{ kind: "locked"/);
  assert.match(quoteRoute, /VERSIONED_QUOTE_COMMERCIAL_LOCK/);
});

// FSA2-002
test("9 request approval threshold cannot redefine policy", () => {
  assert.match(pricingRoute, /COMMERCIAL_POLICY_SERVER_OWNED/);
  assert.match(pricingRoute, /minimumMarginPercent !== undefined/);
  assert.match(pricingRoute, /approvalBelowMarginPercent !== undefined/);
});
test("10 Accounts cannot override commercial policy", () => assert.equal(staffCapabilitiesForRole("accounts").canOverrideCommercialPolicy, false));
test("11 Commercial cannot override commercial policy", () => assert.equal(staffCapabilitiesForRole("commercial").canOverrideCommercialPolicy, false));
test("12 Management policy source determines approval thresholds", () => {
  assert.match(pricingServer, /minimum_margin_percent: COMMERCIAL_MINIMUM_MARGIN_PERCENT/);
  assert.match(pricingServer, /approval_below_margin_percent: COMMERCIAL_APPROVAL_BELOW_MARGIN_PERCENT/);
  assert.match(pricingServer, /pricing_policy_id: COMMERCIAL_POLICY_ID/);
});
test("13 Accounts cannot use arbitrary manual FX", () => assert.equal(staffCapabilitiesForRole("accounts").canOverrideFx, false));
test("14 Commercial cannot use arbitrary manual FX", () => assert.equal(staffCapabilitiesForRole("commercial").canOverrideFx, false));
test("15 Management manual FX override is explicit", () => {
  assert.equal(staffCapabilitiesForRole("management").canOverrideFx, true);
  assert.match(pricingRoute, /MANUAL_FX_FORBIDDEN/);
  assert.match(pricingRoute, /MANUAL_FX_REASON_REQUIRED/);
});
test("16 Management manual FX override records immutable provenance", () => {
  assert.match(pricingServer, /source: "manual_override"/);
  assert.match(pricingServer, /override_actor_email/);
  assert.match(pricingServer, /override_reason/);
  assert.match(pricingServer, /override_at/);
});
test("17 automatic FX remains server-derived from NRB", () => {
  assert.match(pricingRoute, /manualFx \? "manual" : "nrb"/);
  assert.match(pricingServer, /getNrbForexSnapshot/);
  assert.match(pricingServer, /nrbFx\(/);
});
test("18 arbitrary fxRate without explicit manual mode is rejected", () => assert.match(pricingRoute, /MANUAL_FX_MODE_REQUIRED/));
test("19 real policy provenance change changes fingerprint", () => {
  const a = commercialSnapshot();
  const b = commercialSnapshot({ pricing: { pricing_policy_id: "kcpl-server-commercial-policy-v2" } });
  assert.notEqual(commercialFingerprint(a), commercialFingerprint(b));
});
test("20 real manual FX provenance change changes fingerprint", () => {
  const a = commercialSnapshot({ fx: { source: "manual_override", override_actor_name: "Manager", override_actor_email: "m@kcpl.test", override_reason: "contract A", override_at: "2026-08-23T00:00:00.000Z" } });
  const b = commercialSnapshot({ fx: { source: "manual_override", override_actor_name: "Manager", override_actor_email: "m@kcpl.test", override_reason: "contract B", override_at: "2026-08-23T00:00:00.000Z" } });
  assert.notEqual(commercialFingerprint(a), commercialFingerprint(b));
});
test("21 old approval is not transferred across repricing", () => {
  assert.match(pricingServer, /commercial_approvals/);
  assert.match(pricingServer, /expectedId/);
  assert.match(pricingServer, /expectedFp/);
  assert.match(pricingServer, /stale_commercial_state/);
});
test("22 Accounts finance permission remains functional", () => {
  const accounts = staffCapabilitiesForRole("accounts");
  assert.equal(accounts.canManageFinance, true);
  assert.equal(accounts.canEditCommercial, true);
  assert.equal(accounts.canOverrideFx, false);
});

// FSA2-003
test("23 exact customer authority permits exact-version booking path", () => assert.match(tenderServer, /assertCustomerSellAuthorityInTransaction\(transaction, version\)/));
test("24 V1 authority cannot permit V2 booking", () => {
  assert.match(customerAuthority, /record\.commercial_version_id === version\.id/);
  assert.match(customerAuthority, /record\.commercial_fingerprint === version\.fingerprint/);
});
test("25 booking without customer authority is blocked", () => assert.match(tenderRoute, /customer_acceptance_required/));
test("26 tender requires exact issued customer quote", () => assert.match(tenderServer, /assertCustomerQuoteIssuedInTransaction\(transaction, version\)/));
test("27 wrong customer authority is blocked", () => assert.match(customerAuthority, /record\.customer_id === customerId/));
test("28 wrong order authority is blocked", () => assert.match(customerAuthority, /record\.order_id === normalizeCommercialId\(version\.snapshot\.order_id\)/));
test("29 wrong fingerprint authority is blocked", () => assert.match(customerAuthority, /record\.commercial_fingerprint === version\.fingerprint/));
test("30 wrong sell amount and currency are blocked", () => {
  assert.match(customerAuthority, /record\.sell_currency === sellCurrency/);
  assert.match(customerAuthority, /sameCommercialMoney\(record\.sell_amount, pricing\.sell_amount/);
});
test("31 stale order quoted_reference cannot bypass exact acceptance", () => {
  assert.doesNotMatch(tenderServer, /const explicitQuoteReference = nullable\(orderData\.quoted_reference\)/);
  assert.match(tenderServer, /const explicitQuoteReference = customerAuthority\.quoteReference/);
});
test("32 manually supplied quote reference cannot authorize booking", () => assert.doesNotMatch(tenderServer, /booking.*quoteReference.*input/is));
test("33 internal quote bridge alone is not customer acceptance", () => {
  assert.match(tenderServer, /source: "tms_order_booking_bridge"/);
  assert.match(customerAuthority, /tms_sell_pricing_engine/);
  assert.match(customerAuthority, /commercial_customer_acceptances/);
});
test("34 wrong customer branch is blocked at acceptance and booking", () => {
  assert.match(customerAuthority, /primary_branch[\s\S]*branch/);
  assert.match(tenderServer, /primary_branch[\s\S]*branch/);
});
test("35 exact current acceptance is retry-idempotent", () => assert.match(customerAuthority, /acceptanceDoc\.exists[\s\S]*idempotent: true/));
test("36 booking authority is reread in the canonical transaction", () => {
  assert.match(tenderServer, /db\.runTransaction/);
  assert.match(customerAuthority, /transaction\.get\(acceptanceRef\(version\.id\)\)/);
});
test("37 consolidation requires every source house exact authority", () => assert.match(consolidation, /assertCustomerSellAuthorityInTransaction\(transaction, source\.version\)/));
test("38 consolidation carries customer authority only when sell economics match", () => {
  assert.match(consolidation, /customerSellEconomicsMatch\(source\.snapshot, derived\.snapshot\)/);
  assert.match(consolidation, /createCarriedCustomerSellAuthorityInTransaction/);
});
test("39 buy-only derived version can explicitly preserve customer sell authority", () => {
  assert.equal(customerSellEconomicsMatch(commercialSnapshot(), commercialSnapshot({ procurement: { total: 110 } })), true);
});
test("40 sell change cannot carry customer authority", () => {
  assert.equal(customerSellEconomicsMatch(commercialSnapshot(), commercialSnapshot({ pricing: { sell_amount: 121 } })), false);
  assert.equal(customerSellEconomicsMatch(commercialSnapshot(), commercialSnapshot({ pricing: { sell_currency: "USD" } })), false);
});

// FSA2-004
test("41 same-branch rate card is allowed", () => assert.equal(rateCardAppliesToOrder(order("Kathmandu"), card("Kathmandu")), true));
test("42 Global rate card is allowed", () => assert.equal(rateCardAppliesToOrder(order("Kathmandu"), card("Global")), true));
test("43 wrong-branch rate card is blocked", () => assert.equal(rateCardAppliesToOrder(order("Kathmandu"), card("Birgunj")), false));
test("44 all-branch Management remains commercially constrained", () => {
  assert.equal(staffCapabilitiesForRole("management").canManageRateCards, true);
  assert.equal(rateCardAppliesToOrder(order("Kathmandu"), card("Birgunj")), false);
});
test("45 Commercial role remains commercially constrained by rate applicability", () => {
  assert.equal(staffCapabilitiesForRole("commercial").canManageRateCards, true);
  assert.equal(rateCardAppliesToOrder(order("Kathmandu"), card("Birgunj")), false);
});
test("46 malformed card or order branch fails closed", () => {
  assert.equal(rateCardAppliesToOrder(order("Unknown"), card("Kathmandu")), false);
  assert.equal(rateCardAppliesToOrder(order("Kathmandu"), card("Unknown")), false);
});
test("47 branch applicability provenance changes fingerprint", () => {
  const a = commercialSnapshot();
  const b = commercialSnapshot({ procurement: { rate_card_branch: "Global" } });
  assert.notEqual(commercialFingerprint(a), commercialFingerprint(b));
});
test("48 selected versions persist historical rate scope", () => {
  assert.match(ratingServer, /rate_card_branch: card\.branch/);
  assert.match(ratingServer, /rate_card_origin: card\.origin/);
  assert.match(ratingServer, /rate_card_destination: card\.destination/);
});
test("49 legacy reconstruction cannot prove a current wrong-branch rate card", () => assert.match(lineageServer, /legacy_rate_card_branch_mismatch/));
test("50 consolidation derives historical house rate scope from booked master version, not mutable current card", () => {
  assert.match(consolidation, /masterVersion\.snapshot\.procurement\.rate_card_branch/);
  assert.match(consolidation, /masterRateCardOrigin: masterVersion\.snapshot\.procurement\.rate_card_origin/);
});

// Required race and cross-remediation guards
test("51 V1 acceptance versus V2 repricing is serialized by current order reads", () => {
  assert.match(customerAuthority, /const order = await transaction\.get\(orderRef\)/);
  assert.match(pricingServer, /const orderSnapshot = await transaction\.get\(orderRef\)/);
});
test("52 V2 acceptance versus booking consumes the same exact immutable identity", () => {
  assert.match(customerAuthority, /commercial_fingerprint/);
  assert.match(tenderServer, /orderPointer\.fingerprint !== version\.fingerprint/);
});
test("53 rate-card branch edit versus selection uses the current card transaction read", () => assert.match(ratingServer, /transaction\.get\(db\.collection\("partner_rate_cards"\)\.doc\(rateCardId\)\)/));
test("54 Management approval versus repricing stays exact-version CAS", () => {
  assert.match(pricingServer, /commercial_version_id[\s\S]*expectedId/);
  assert.match(pricingServer, /commercial_fingerprint[\s\S]*expectedFp/);
});
test("55 manual FX override versus booking consumes persisted exact version", () => {
  assert.match(tenderServer, /tenderCommercialVersionInTransaction/);
  assert.match(tenderServer, /orderPointer\.id !== version\.id/);
});
test("56 generic Won versus TMS booking cannot create two TMS shipment authorities", () => {
  assert.match(shipmentServer, /tms-authority-required/);
  assert.match(tenderServer, /commercialBookedSnapshotFields\(version\)/);
});
test("57 #126 settlement regression suite remains in full test command", () => assert.match(packageJson.scripts.test, /financial-settlement-integrity\.test\.mjs/));
test("58 #127 booking concurrency regression suite remains in full test command", () => assert.match(packageJson.scripts.test, /tms-booking-lineage-dispatch\.test\.mjs/));
test("59 #128 RBAC regression suites remain in full test command", () => {
  assert.match(packageJson.scripts.test, /rbac-security\.test\.mjs/);
  assert.match(packageJson.scripts.test, /rbac-trust-boundaries\.test\.mjs/);
});
test("60 #129 commercial lineage regression suites remain in full test command", () => {
  assert.match(packageJson.scripts.test, /commercial-economic-lineage\.test\.mjs/);
  assert.match(packageJson.scripts.test, /commercial-profitability-lineage\.test\.mjs/);
});
test("61 #130 external workflow regression suites remain in full test command", () => {
  assert.match(packageJson.scripts.test, /external-workflow-state\.test\.mjs/);
  assert.match(packageJson.scripts.test, /external-workflow-ingestion-hardening\.test\.mjs/);
});
