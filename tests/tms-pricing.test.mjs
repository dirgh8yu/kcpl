import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSellPrice,
  deriveNrbMidpointFxRate,
  resolvePricingRule,
} from "../app/admin/pricing/tms-pricing.ts";

const context = { branch: "Kathmandu", customer_id: "KCPL-C-1", origin: "Kathmandu", destination: "Kolkata", mode: "road" };
const baseRule = {
  id: "R1", name: "Global", active: true, priority: 0, scope: "global", branch: null, customer_id: null,
  origin: null, destination: null, mode: null, sell_currency: null, markup_percent: 15, target_margin_percent: null,
  minimum_margin_percent: 10, accessorial_markup_percent: 15, fixed_markup: 0, approval_below_margin_percent: 12,
  notes: null, created_at: "2026-08-20T00:00:00Z", updated_at: "2026-08-20T00:00:00Z",
};

test("customer lane rule outranks global and branch rules", () => {
  const rules = [
    baseRule,
    { ...baseRule, id: "R2", name: "Branch", scope: "branch", branch: "Kathmandu", markup_percent: 18 },
    { ...baseRule, id: "R3", name: "Customer lane", scope: "customer_lane", customer_id: "KCPL-C-1", origin: "Kathmandu", destination: "Kolkata", mode: "road", markup_percent: 22 },
  ];
  assert.equal(resolvePricingRule(rules, context)?.id, "R3");
});

test("inactive specific rules never override an active broader rule", () => {
  const rules = [
    baseRule,
    { ...baseRule, id: "R2", name: "Inactive customer lane", active: false, scope: "customer_lane", customer_id: "KCPL-C-1", origin: "Kathmandu", destination: "Kolkata", mode: "road", markup_percent: 2 },
  ];
  assert.equal(resolvePricingRule(rules, context)?.id, "R1");
});

test("markup pricing includes marked-up accessorials and fixed markup", () => {
  const result = calculateSellPrice({
    buy_cost: 1000, buy_currency: "USD", sell_currency: "USD", fx_rate: 1, markup_percent: 20,
    target_margin_percent: null, minimum_margin_percent: 10, approval_below_margin_percent: 10,
    accessorial_cost: 100, accessorial_markup_percent: 25, fixed_markup: 50, discount: 0,
  });
  assert.equal(result.converted_buy_cost, 1000);
  assert.equal(result.accessorial_sell, 125);
  assert.equal(result.sell_price, 1375);
  assert.equal(result.gross_profit, 275);
  assert.equal(result.approval_required, false);
});

test("target margin raises sell price above simple markup when required", () => {
  const result = calculateSellPrice({
    buy_cost: 1000, buy_currency: "USD", sell_currency: "USD", fx_rate: 1, markup_percent: 5,
    target_margin_percent: 25, minimum_margin_percent: 10, approval_below_margin_percent: 10,
    accessorial_cost: 0, accessorial_markup_percent: 0, fixed_markup: 0, discount: 0,
  });
  assert.equal(result.sell_price, 1333.33);
  assert.ok(result.gross_margin_percent > 24.99 && result.gross_margin_percent < 25.01);
});

test("discount that breaches margin floor requires approval", () => {
  const result = calculateSellPrice({
    buy_cost: 1000, buy_currency: "USD", sell_currency: "USD", fx_rate: 1, markup_percent: 20,
    target_margin_percent: null, minimum_margin_percent: 12, approval_below_margin_percent: 15,
    accessorial_cost: 0, accessorial_markup_percent: 0, fixed_markup: 0, discount: 150,
  });
  assert.equal(result.sell_price, 1050);
  assert.equal(result.approval_required, true);
  assert.ok(result.approval_reasons.some((reason) => reason.includes("minimum margin")));
  assert.ok(result.approval_reasons.some((reason) => reason.includes("manual discount")));
});

test("NRB midpoint rates derive foreign-to-foreign cross rate through NPR", () => {
  const rates = [
    { currency: "USD", midpoint_per_unit: 140 },
    { currency: "INR", midpoint_per_unit: 1.6 },
  ];
  assert.equal(deriveNrbMidpointFxRate("USD", "NPR", rates), 140);
  assert.equal(deriveNrbMidpointFxRate("NPR", "INR", rates), 0.625);
  assert.equal(deriveNrbMidpointFxRate("USD", "INR", rates), 87.5);
  assert.equal(deriveNrbMidpointFxRate("USD", "AUD", rates), null);
});

test("same-currency pricing never needs an external FX rate", () => {
  assert.equal(deriveNrbMidpointFxRate("NPR", "NPR", []), 1);
});
