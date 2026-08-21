import test from "node:test";
import assert from "node:assert/strict";
import {
  tenderCanBook,
  tenderCanCancel,
  tenderFinalCommercials,
  tenderIsActive,
  tenderIsExpired,
  tenderIsTerminal,
  tenderResponseAllowed,
} from "../app/admin/tenders/tms-tendering.ts";

const baseTender = {
  status: "sent",
  response_due_at: "2026-08-22T12:00:00.000Z",
  currency: "USD",
  offered_cost: 1200,
  counter_cost: null,
  counter_currency: null,
};

test("sent tenders accept only a first carrier response", () => {
  assert.equal(tenderResponseAllowed("sent", "accepted"), true);
  assert.equal(tenderResponseAllowed("sent", "rejected"), true);
  assert.equal(tenderResponseAllowed("sent", "countered"), true);
  assert.equal(tenderResponseAllowed("accepted", "rejected"), false);
  assert.equal(tenderResponseAllowed("countered", "accepted"), false);
});

test("only accepted or countered tenders can be booked", () => {
  assert.equal(tenderCanBook("accepted"), true);
  assert.equal(tenderCanBook("countered"), true);
  assert.equal(tenderCanBook("sent"), false);
  assert.equal(tenderCanBook("rejected"), false);
  assert.equal(tenderCanBook("booked"), false);
});

test("counter-offer commercials become the booking snapshot", () => {
  assert.deepEqual(tenderFinalCommercials({ ...baseTender, status: "accepted" }), { amount: 1200, currency: "USD" });
  assert.deepEqual(tenderFinalCommercials({ ...baseTender, status: "countered", counter_cost: 1325, counter_currency: "USD" }), { amount: 1325, currency: "USD" });
  assert.equal(tenderFinalCommercials({ ...baseTender, status: "countered" }), null);
  assert.equal(tenderFinalCommercials({ ...baseTender, status: "sent" }), null);
});

test("only live sent tenders expire by deadline", () => {
  assert.equal(tenderIsExpired(baseTender, "2026-08-22T11:59:59.000Z"), false);
  assert.equal(tenderIsExpired(baseTender, "2026-08-22T12:00:00.000Z"), true);
  assert.equal(tenderIsExpired({ ...baseTender, status: "accepted" }, "2026-08-22T13:00:00.000Z"), false);
});

test("active and terminal state definitions prevent duplicate procurement", () => {
  for (const status of ["sent", "accepted", "countered"]) assert.equal(tenderIsActive(status), true);
  for (const status of ["rejected", "expired", "cancelled", "booked"]) assert.equal(tenderIsTerminal(status), true);
  assert.equal(tenderCanCancel("sent"), true);
  assert.equal(tenderCanCancel("accepted"), true);
  assert.equal(tenderCanCancel("countered"), true);
  assert.equal(tenderCanCancel("booked"), false);
});
