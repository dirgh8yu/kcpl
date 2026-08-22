import test from "node:test";
import assert from "node:assert/strict";
import {
  pickupTransitionAllowed,
  pickupNeedsAttention,
  summarizePickups,
  validAppointmentWindow,
} from "../app/admin/pickups/pickup-appointments.ts";

const base = {
  id: "PU-KCPL-S-1",
  shipment_reference: "KCPL-S-1",
  transport_order_id: "ORD-1",
  tender_id: "TND-1",
  booking_reference: "BOOK-1",
  branch: "Kathmandu",
  customer_id: "C-1",
  customer_name: "Customer",
  partner_id: "P-1",
  partner_name: "Carrier",
  origin: "Kathmandu",
  destination: "Birgunj",
  status: "unscheduled",
  channel: "manual",
  requested_window_start: null,
  requested_window_end: null,
  confirmed_window_start: null,
  confirmed_window_end: null,
  pickup_location: "Kathmandu",
  contact_name: null,
  contact_phone: null,
  provider_reference: null,
  driver_name: null,
  driver_phone: null,
  vehicle_reference: null,
  attempt_count: 0,
  picked_up_at: null,
  missed_at: null,
  missed_reason: null,
  notes: null,
  created_at: null,
  updated_at: "2026-08-22T00:00:00.000Z",
  shipment_status: "booking_confirmed",
  current_location: null,
};

test("pickup appointment windows require an end after the start", () => {
  assert.equal(validAppointmentWindow("2026-08-22T03:00:00.000Z", "2026-08-22T05:00:00.000Z"), true);
  assert.equal(validAppointmentWindow("2026-08-22T05:00:00.000Z", "2026-08-22T03:00:00.000Z"), false);
  assert.equal(validAppointmentWindow(null, "2026-08-22T05:00:00.000Z"), false);
});

test("picked up and cancelled appointments are terminal", () => {
  assert.equal(pickupTransitionAllowed("confirmed", "picked_up"), true);
  assert.equal(pickupTransitionAllowed("missed", "confirmed"), true);
  assert.equal(pickupTransitionAllowed("picked_up", "requested"), false);
  assert.equal(pickupTransitionAllowed("cancelled", "confirmed"), false);
});

test("missed appointments can be rescheduled without reopening a completed pickup", () => {
  assert.equal(pickupTransitionAllowed("missed", "requested"), true);
  assert.equal(pickupTransitionAllowed("missed", "driver_assigned"), true);
  assert.equal(pickupTransitionAllowed("picked_up", "missed"), false);
});

test("unscheduled bookings and overdue windows need attention", () => {
  assert.equal(pickupNeedsAttention(base, "2026-08-22T06:00:00.000Z"), true);
  const overdue = { ...base, status: "confirmed", confirmed_window_start: "2026-08-22T01:00:00.000Z", confirmed_window_end: "2026-08-22T02:00:00.000Z" };
  assert.equal(pickupNeedsAttention(overdue, "2026-08-22T06:00:00.000Z"), true);
  const future = { ...overdue, confirmed_window_end: "2026-08-22T08:00:00.000Z" };
  assert.equal(pickupNeedsAttention(future, "2026-08-22T06:00:00.000Z"), false);
});

test("pickup summary separates workflow states and completed pickups", () => {
  const rows = [
    base,
    { ...base, id: "2", shipment_reference: "S2", status: "requested", requested_window_end: "2026-08-23T02:00:00.000Z" },
    { ...base, id: "3", shipment_reference: "S3", status: "confirmed", confirmed_window_end: "2026-08-23T03:00:00.000Z" },
    { ...base, id: "4", shipment_reference: "S4", status: "driver_assigned", confirmed_window_end: "2026-08-23T04:00:00.000Z" },
    { ...base, id: "5", shipment_reference: "S5", status: "missed", missed_at: "2026-08-22T04:00:00.000Z" },
    { ...base, id: "6", shipment_reference: "S6", status: "picked_up", picked_up_at: "2026-08-22T05:00:00.000Z" },
  ];
  const summary = summarizePickups(rows, "2026-08-22T06:00:00.000Z");
  assert.equal(summary.unscheduled, 1);
  assert.equal(summary.requested, 1);
  assert.equal(summary.confirmed, 1);
  assert.equal(summary.driver_assigned, 1);
  assert.equal(summary.missed, 2); // explicit missed + unscheduled booking needing attention
  assert.equal(summary.picked_up_today, 1);
});
