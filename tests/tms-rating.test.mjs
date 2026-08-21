import test from "node:test";
import assert from "node:assert/strict";
import { calculateRating, rateCardIsValidOn, rateLocationMatches, rateOrder, ratingQuantity } from "../app/admin/rating/tms-rating.ts";

function order(overrides = {}) {
  return {
    id: "ORD-TEST",
    branch: "Kathmandu",
    customer_id: null,
    customer_name: null,
    origin: "Kathmandu",
    destination: "Kolkata",
    mode: "road",
    pickup_date: "2026-08-22",
    delivery_date: null,
    weight_kg: 500,
    volume_cbm: 3,
    pieces: 10,
    container_count: 0,
    equipment: "Truck",
    temperature_requirement: null,
    carrier_requirement: null,
    notes: null,
    status: "draft",
    selected_rate_card_id: null,
    selected_partner_id: null,
    selected_cost: null,
    selected_currency: null,
    created_at: "2026-08-22T00:00:00.000Z",
    created_by_name: "Test",
    created_by_email: "test@kcpl",
    updated_at: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

function card(overrides = {}) {
  return {
    id: "BUY-1",
    partner_id: "PARTNER-1",
    partner_name: "Test Carrier",
    branch: "Global",
    origin: "Kathmandu",
    destination: "Kolkata",
    mode: "road",
    service: "Standard",
    equipment: "Truck",
    currency: "NPR",
    rate: 10,
    unit: "per_kg",
    minimum_charge: 0,
    fuel_surcharge_percent: 10,
    accessorial_flat: 250,
    transit_days_min: 2,
    transit_days_max: 3,
    valid_from: "2026-08-01",
    valid_until: "2026-08-31",
    active: true,
    notes: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("location matching is normalized and supports explicit wildcard lanes", () => {
  assert.equal(rateLocationMatches(" kathmandu ", "Kathmandu"), true);
  assert.equal(rateLocationMatches("*", "Birgunj"), true);
  assert.equal(rateLocationMatches("Any", "Kolkata"), true);
  assert.equal(rateLocationMatches("Kathmandu", "Birgunj"), false);
});

test("rate validity fails closed for inactive and out-of-window cards", () => {
  assert.equal(rateCardIsValidOn(card(), "2026-08-22"), true);
  assert.equal(rateCardIsValidOn(card({ active: false }), "2026-08-22"), false);
  assert.equal(rateCardIsValidOn(card({ valid_until: "2026-08-21" }), "2026-08-22"), false);
  assert.equal(rateCardIsValidOn(card({ valid_from: "2026-08-23" }), "2026-08-22"), false);
});

test("rating quantity uses the correct cargo basis", () => {
  const value = order({ weight_kg: 2500, volume_cbm: 8, pieces: 25, container_count: 2 });
  assert.equal(ratingQuantity(value, "per_kg"), 2500);
  assert.equal(ratingQuantity(value, "per_tonne"), 2.5);
  assert.equal(ratingQuantity(value, "per_cbm"), 8);
  assert.equal(ratingQuantity(value, "per_piece"), 25);
  assert.equal(ratingQuantity(value, "per_container"), 2);
  assert.equal(ratingQuantity(value, "flat"), 1);
});

test("rating applies minimum charge before fuel and then flat accessorials", () => {
  const result = calculateRating(order({ weight_kg: 50 }), card({ rate: 10, minimum_charge: 1000, fuel_surcharge_percent: 10, accessorial_flat: 250 }));
  assert.ok(result);
  assert.equal(result.linehaul, 1000);
  assert.equal(result.minimum_applied, true);
  assert.equal(result.fuel_surcharge, 100);
  assert.equal(result.accessorials, 250);
  assert.equal(result.total_cost, 1350);
});

test("rating rejects incompatible mode, equipment, lane and zero cargo basis", () => {
  assert.equal(calculateRating(order(), card({ mode: "air" })), null);
  assert.equal(calculateRating(order(), card({ equipment: "40HC" })), null);
  assert.equal(calculateRating(order(), card({ destination: "Delhi" })), null);
  assert.equal(calculateRating(order({ weight_kg: 0 }), card({ unit: "per_kg" })), null);
});

test("rate ordering keeps currencies separate and orders cheapest first within currency", () => {
  const results = rateOrder(order(), [
    card({ id: "NPR-EXP", partner_name: "Expensive", rate: 12 }),
    card({ id: "USD", partner_name: "Dollar", currency: "USD", rate: 1 }),
    card({ id: "NPR-CHEAP", partner_name: "Cheap", rate: 9 }),
  ]);
  assert.deepEqual(results.map((result) => result.rate_card_id), ["NPR-CHEAP", "NPR-EXP", "USD"]);
});
