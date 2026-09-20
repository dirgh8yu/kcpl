import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  freeTimeNeedsAttention,
  freeTimeReminderThreshold,
  freeTimeStatus,
  freeTimeSummary,
  shipmentFreeTimeFromRecord,
} from "../app/shipment-free-time.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

const allowance = (overrides = {}) => shipmentFreeTimeFromRecord({
  free_time_location: "Birgunj ICD",
  free_time_days: 3,
  free_time_started_on: "2026-09-18",
  free_time_daily_charge: 45,
  free_time_charge_currency: "USD",
  free_time_bearer: "customer",
  ...overrides,
});

/* ------------------------------------------------------------------ *
 * The arithmetic that decides whether somebody is about to be charged
 * ------------------------------------------------------------------ */

test("the allowance includes the day it starts", () => {
  // 3 free days from the 18th covers the 18th, 19th and 20th. Counting from
  // the day after would tell a customer they are safe on the day a charge
  // starts.
  const status = freeTimeStatus(allowance(), "2026-09-18");
  assert.equal(status.deadline, "2026-09-20");
  assert.equal(status.daysRemaining, 2);
  assert.equal(status.state, "running");
});

test("the last day is its own state, not an expired one", () => {
  const status = freeTimeStatus(allowance(), "2026-09-20");
  assert.equal(status.state, "last_day");
  assert.equal(status.daysRemaining, 0);
  assert.equal(status.daysOverdue, 0);
  assert.equal(status.projectedCharge, null, "nothing has accrued yet on the last free day");
});

test("expiry starts the charge on the following day", () => {
  const status = freeTimeStatus(allowance(), "2026-09-21");
  assert.equal(status.state, "expired");
  assert.equal(status.daysOverdue, 1);
  assert.equal(status.projectedCharge, 45);
  assert.equal(freeTimeStatus(allowance(), "2026-09-25").projectedCharge, 45 * 5);
});

test("a one-day allowance expires at the end of its own day", () => {
  const single = allowance({ free_time_days: 1 });
  assert.equal(freeTimeStatus(single, "2026-09-18").state, "last_day");
  assert.equal(freeTimeStatus(single, "2026-09-19").state, "expired");
});

test("an allowance crossing a month boundary counts real calendar days", () => {
  const crossing = allowance({ free_time_days: 5, free_time_started_on: "2026-09-29" });
  const status = freeTimeStatus(crossing, "2026-10-01");
  assert.equal(status.deadline, "2026-10-03");
  assert.equal(status.daysRemaining, 2);
});

test("an incomplete record is not a countdown", () => {
  assert.equal(freeTimeStatus(allowance({ free_time_days: null }), "2026-09-18").state, "not_set");
  assert.equal(freeTimeStatus(allowance({ free_time_started_on: null }), "2026-09-18").state, "not_set");
  assert.equal(freeTimeStatus(allowance({ free_time_started_on: "18-09-2026" }), "2026-09-18").state, "not_set");
});

test("nonsense in the record never becomes a number on a customer's screen", () => {
  const record = shipmentFreeTimeFromRecord({
    free_time_days: -4,
    free_time_daily_charge: -10,
    free_time_started_on: "not-a-date",
    free_time_bearer: "whoever",
  });
  assert.equal(record.days, null);
  assert.equal(record.daily_charge, null);
  assert.equal(record.started_on, null);
  assert.equal(record.bearer, "undecided", "an unknown bearer is never assumed to be the customer");
});

test("charges with no rate on record show no figure", () => {
  const status = freeTimeStatus(allowance({ free_time_daily_charge: null }), "2026-09-25");
  assert.equal(status.state, "expired");
  assert.equal(status.projectedCharge, null);
});

/* ------------------------------------------------------------------ *
 * What gets put in front of someone
 * ------------------------------------------------------------------ */

test("attention is drawn only as the clock runs down", () => {
  assert.equal(freeTimeNeedsAttention(freeTimeStatus(allowance({ free_time_days: 30 }), "2026-09-18")), false);
  assert.equal(freeTimeNeedsAttention(freeTimeStatus(allowance(), "2026-09-18")), true);
  assert.equal(freeTimeNeedsAttention(freeTimeStatus(allowance(), "2026-09-25")), true);
  assert.equal(freeTimeNeedsAttention(freeTimeStatus(allowance({ free_time_days: null }), "2026-09-18")), false);
});

test("reminders fire at three steps and then stop", () => {
  const at = (today) => freeTimeReminderThreshold(freeTimeStatus(allowance({ free_time_days: 10 }), today));
  assert.equal(at("2026-09-24"), 3);
  assert.equal(at("2026-09-26"), 1);
  assert.equal(at("2026-09-27"), 0);
  // Not every day in between, and nothing once expired: a daily countdown is a
  // countdown people stop reading.
  assert.equal(at("2026-09-25"), null);
  assert.equal(at("2026-09-20"), null);
  assert.equal(at("2026-09-28"), null);
});

test("the summary reads as a sentence at every state", () => {
  assert.match(freeTimeSummary(allowance(), freeTimeStatus(allowance(), "2026-09-18")), /2 free days left at Birgunj ICD/);
  assert.match(freeTimeSummary(allowance(), freeTimeStatus(allowance(), "2026-09-19")), /1 free day left/);
  assert.match(freeTimeSummary(allowance(), freeTimeStatus(allowance(), "2026-09-20")), /last free day/);
  assert.match(freeTimeSummary(allowance(), freeTimeStatus(allowance(), "2026-09-21")), /ended yesterday/);
  assert.match(freeTimeSummary(allowance(), freeTimeStatus(allowance(), "2026-09-24")), /ended 4 days ago/);
});

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

test("the free-time route writes free-time fields and nothing canonical", async () => {
  const source = await readFile(repo("app/api/admin/jobs/[reference]/free-time/route.ts"), "utf8");
  assert.match(source, /canManageJobFile/);
  assert.match(source, /checkShipmentBranchAccess/);
  assert.doesNotMatch(source, /status:\s*"/, "no shipment status is written");
  assert.doesNotMatch(source, /amount_paid|balance_due|delivery_state/);
});

test("a countdown needs both halves or neither", async () => {
  const source = await readFile(repo("app/api/admin/jobs/[reference]/free-time/route.ts"), "utf8");
  // An allowance with no start date cannot be counted, and a start date with
  // no allowance is not a countdown either.
  assert.match(source, /\(days\.value === null\) !== \(!startedOn\)/);
});

test("the customer never sees KCPL's internal free-time note", async () => {
  const source = await readFile(repo("app/portal/portal-data.server.ts"), "utf8");
  assert.match(source, /freeTime: \{ \.\.\.freeTime, note: null \}/);
});
