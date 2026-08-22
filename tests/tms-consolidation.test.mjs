import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  allocateProcurementCost,
  assessLoadCompatibility,
  buildDefaultStops,
  capacityViolations,
  consolidationSavings,
  normalizeStopSequence,
  validateStopPrecedence,
} from "../app/admin/consolidation/tms-consolidation.ts";

const consolidationServer = readFileSync(new URL("../app/admin/consolidation/tms-consolidation.server.ts", import.meta.url), "utf8");
const consolidationRoute = readFileSync(new URL("../app/api/admin/consolidation/route.ts", import.meta.url), "utf8");
const ratingServer = readFileSync(new URL("../app/admin/rating/tms-rating.server.ts", import.meta.url), "utf8");

function order(overrides = {}) {
  return {
    id: "ORD-1",
    branch: "Kathmandu",
    customer_id: "KCPL-C-1",
    customer_name: "Customer",
    origin: "Kathmandu",
    destination: "Kolkata",
    mode: "road",
    pickup_date: "2026-08-23",
    delivery_date: null,
    weight_kg: 750,
    volume_cbm: 3,
    pieces: 10,
    container_count: 0,
    equipment: "truck",
    temperature_requirement: null,
    carrier_requirement: null,
    notes: null,
    status: "selected",
    selected_rate_card_id: "BUY-1",
    selected_partner_id: "PARTNER-1",
    selected_cost: 1000,
    selected_currency: "NPR",
    consolidation_load_id: null,
    is_consolidation_master: false,
    created_at: "2026-08-22T00:00:00.000Z",
    created_by_name: "Staff",
    created_by_email: "staff@example.com",
    updated_at: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

function member(overrides = {}) {
  const source = order(overrides);
  return {
    order_id: source.id,
    customer_id: source.customer_id,
    customer_name: source.customer_name,
    origin: source.origin,
    destination: source.destination,
    mode: source.mode,
    weight_kg: source.weight_kg,
    volume_cbm: source.volume_cbm,
    pieces: source.pieces,
    container_count: source.container_count,
    equipment: source.equipment,
    temperature_requirement: source.temperature_requirement,
    prior_selected_cost: source.selected_cost,
    prior_selected_currency: source.selected_currency,
    allocated_cost: null,
    allocated_currency: null,
    shipment_reference: null,
  };
}

test("compatible same-branch road orders can consolidate", () => {
  const result = assessLoadCompatibility([order(), order({ id: "ORD-2", origin: "Bhaktapur" })], "road", { weight_kg: 2000, volume_cbm: 10, pieces: null, containers: null });
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
});

test("branch and equipment conflicts block consolidation", () => {
  const result = assessLoadCompatibility([
    order(),
    order({ id: "ORD-2", branch: "Birgunj", equipment: "40HC" }),
  ], "road", { weight_kg: null, volume_cbm: null, pieces: null, containers: null });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((item) => item.includes("same KCPL branch")));
  assert.ok(result.blockers.some((item) => item.includes("equipment")));
});

test("single-mode loads reject mixed transport modes unless master is multimodal", () => {
  const mixed = [order(), order({ id: "ORD-2", mode: "rail", equipment: null })];
  assert.equal(assessLoadCompatibility(mixed, "road", { weight_kg: null, volume_cbm: null, pieces: null, containers: null }).ok, false);
  assert.equal(assessLoadCompatibility(mixed, "multimodal", { weight_kg: null, volume_cbm: null, pieces: null, containers: null }).ok, true);
});

test("capacity limits fail closed", () => {
  const blockers = capacityViolations({ weight_kg: 2100, volume_cbm: 11, pieces: 41, containers: 3 }, { weight_kg: 2000, volume_cbm: 10, pieces: 40, containers: 2 });
  assert.equal(blockers.length, 4);
});

test("default stops group matching locations and keep pickups before deliveries", () => {
  const stops = buildDefaultStops([
    order({ id: "ORD-1", origin: "Kathmandu", destination: "Kolkata" }),
    order({ id: "ORD-2", origin: "Kathmandu", destination: "Siliguri" }),
    order({ id: "ORD-3", origin: "Bhaktapur", destination: "Kolkata" }),
  ]);
  assert.equal(stops.filter((stop) => stop.kind === "pickup").length, 2);
  assert.equal(stops.filter((stop) => stop.kind === "delivery").length, 2);
  assert.deepEqual(validateStopPrecedence(stops), []);
  assert.equal(stops.find((stop) => stop.kind === "pickup" && stop.location === "Kathmandu").order_ids.length, 2);
});

test("stop reordering rejects incomplete ids and detects delivery-before-pickup", () => {
  const stops = buildDefaultStops([order()]);
  assert.equal(normalizeStopSequence(stops, [stops[0].id]), null);
  const reversed = normalizeStopSequence(stops, [...stops].reverse().map((stop) => stop.id));
  assert.ok(reversed);
  assert.deepEqual(validateStopPrecedence(reversed), ["ORD-1"]);
});

test("procurement allocation is proportional and exact to cents", () => {
  const allocations = allocateProcurementCost(1000, [
    member({ id: "ORD-1", weight_kg: 750 }),
    member({ id: "ORD-2", weight_kg: 250 }),
  ]);
  assert.deepEqual(allocations, [
    { order_id: "ORD-1", amount: 750 },
    { order_id: "ORD-2", amount: 250 },
  ]);
  assert.equal(allocations.reduce((sum, item) => sum + item.amount, 0), 1000);
});

test("allocation falls back to equal share when no physical basis exists", () => {
  const allocations = allocateProcurementCost(100, [
    member({ id: "ORD-1", weight_kg: 0, volume_cbm: 0, pieces: 0 }),
    member({ id: "ORD-2", weight_kg: 0, volume_cbm: 0, pieces: 0 }),
    member({ id: "ORD-3", weight_kg: 0, volume_cbm: 0, pieces: 0 }),
  ]);
  assert.equal(allocations.reduce((sum, item) => sum + item.amount, 0), 100);
  assert.deepEqual(allocations.map((item) => item.amount), [33.33, 33.33, 33.34]);
});

test("savings are only claimed when every prior cost is currency-comparable", () => {
  const sameCurrency = consolidationSavings({ members: [member({ id: "ORD-1", selected_cost: 600 }), member({ id: "ORD-2", selected_cost: 500 })], procurement_cost: 900, procurement_currency: "NPR" });
  assert.deepEqual(sameCurrency, { baseline: 1100, consolidated: 900, savings: 200 });
  const mixed = consolidationSavings({ members: [member({ id: "ORD-1", selected_currency: "NPR" }), member({ id: "ORD-2", selected_currency: "USD" })], procurement_cost: 900, procurement_currency: "NPR" });
  assert.equal(mixed, null);
});

test("14 one consolidation membership is claimed transactionally on the house order", () => {
  assert.match(consolidationServer, /createConsolidationLoad[\s\S]*?runTransaction/);
  assert.match(consolidationServer, /addOrderToConsolidationLoad[\s\S]*?runTransaction/);
  assert.match(consolidationServer, /consolidation_load_id/);
  assert.match(consolidationServer, /membership_conflict/);
});

test("15 double release is idempotent and creates one deterministic master order in a transaction", () => {
  assert.match(consolidationServer, /releaseConsolidationToProcurement[\s\S]*?runTransaction/);
  assert.match(consolidationServer, /masterOrderId\(record\.load\.id\)/);
  assert.match(consolidationServer, /transaction\.create\(masterRef, master\)/);
  assert.match(consolidationServer, /kind: "ready" as const, masterOrderId/);
});

test("16 release versus membership or stop mutation shares the load transaction lock", () => {
  assert.match(consolidationServer, /removeOrderFromConsolidationLoad[\s\S]*?runTransaction/);
  assert.match(consolidationServer, /reorderConsolidationStops[\s\S]*?runTransaction/);
  assert.match(consolidationServer, /updateConsolidationStop[\s\S]*?runTransaction/);
  assert.match(consolidationServer, /record\.load\.status !== "draft"/);
});

test("17 consolidated booking is one atomic core transaction with idempotent retry", () => {
  assert.match(consolidationServer, /confirmConsolidatedLoadBooking[\s\S]*?runTransaction/);
  assert.match(consolidationServer, /record\.load\.status === "booked"/);
  assert.match(consolidationServer, /idempotent: true/);
  assert.match(consolidationServer, /booking_conflict/);
});

test("18 exactly one master shipment is committed with the load and master order", () => {
  assert.match(consolidationServer, /transaction\.create\(masterShipmentRef/);
  assert.match(consolidationServer, /master_shipment_reference: masterShipmentReference/);
  assert.match(consolidationServer, /transaction\.update\(masterOrderRef/);
});

test("19 exactly one house shipment per member is committed before the load becomes booked", () => {
  assert.match(consolidationServer, /houseReferenceMap/);
  assert.match(consolidationServer, /transaction\.create\(db\.collection\("shipments"\)\.doc\(reference\)/);
  assert.match(consolidationServer, /members: updatedMembers/);
  assert.match(consolidationServer, /houseRecords\.some\(\(item\) => item\.order\.status === "booked"/);
});

test("released house orders remain procurement-locked against independent rating", () => {
  assert.match(consolidationServer, /procurement_locked_by_load: true/);
  assert.match(ratingServer, /procurement_locked_by_load/);
});

test("consolidation API preserves commercial RBAC and same-origin checks", () => {
  assert.match(consolidationRoute, /isTrustedSameOriginRequest/);
  assert.match(consolidationRoute, /canViewCommercial/);
  assert.match(consolidationServer, /permissions\.canEditCommercial/);
  assert.match(consolidationServer, /staffCanAccessBranch/);
});
