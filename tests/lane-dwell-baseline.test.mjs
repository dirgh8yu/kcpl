import assert from "node:assert/strict";
import test from "node:test";

import {
  clearanceDwellHours,
  describeHours,
  dwellWarning,
  laneDwellBaseline,
  minDwellSamples,
} from "../app/admin/customs/lane-dwell-baseline.ts";

const LANE = "guangzhou→birgunj";
const CUSTOMS = "Customs clearance";
const OFD = "Out for delivery";

function stream(entryIso, dwellHours) {
  const entry = Date.parse(entryIso);
  return [
    { title: "Booking confirmed", at: new Date(entry - 96 * 3_600_000).toISOString() },
    { title: CUSTOMS, at: new Date(entry).toISOString() },
    { title: OFD, at: new Date(entry + dwellHours * 3_600_000).toISOString() },
  ];
}

const BASE = "2026-09-01T06:00:00.000Z";

test("dwell reconstruction reads entry→exit from status-label streams", () => {
  const hours = clearanceDwellHours(stream(BASE, 62));
  assert.equal(hours, 62);
  // A stream that never exits customs is censored data — excluded, never
  // counted as a fast or slow completion.
  assert.equal(clearanceDwellHours([{ title: CUSTOMS, at: BASE }]), null);
  assert.equal(clearanceDwellHours([]), null);
});

test("the baseline needs a quorum of completed clearances on the same lane", () => {
  const one = laneDwellBaseline([{ lane: LANE, titles: stream(BASE, 60) }], LANE);
  assert.equal(one.available, false);
  const three = laneDwellBaseline(
    [
      { lane: LANE, titles: stream(BASE, 58) },
      { lane: LANE, titles: stream("2026-08-01T06:00:00.000Z", 70) },
      { lane: LANE, titles: stream("2026-07-01T06:00:00.000Z", 66) },
    ],
    LANE,
  );
  assert.equal(three.available, true);
  assert.equal(three.sample, 3);
  assert.equal(three.medianHours, 66);
  assert.equal(three.p75Hours, 68);
});

test("another lane's completions never leak into the baseline", () => {
  const baseline = laneDwellBaseline(
    [
      { lane: "kolkata→kathmandu", titles: stream(BASE, 10) },
      { lane: "kolkata→kathmandu", titles: stream(BASE, 12) },
      { lane: "kolkata→kathmandu", titles: stream(BASE, 11) },
    ],
    LANE,
  );
  assert.equal(baseline.available, false);
  assert.equal(baseline.sample, 0);
});

test("a live clearance inside the slow-but-normal bound stays quiet", () => {
  const baseline = { available: true, lane: LANE, sample: 3, medianHours: 66, p75Hours: 68 };
  const quiet = dwellWarning({ baseline, elapsedHours: 40 });
  assert.equal(quiet.active, false);
  assert.equal(quiet.message, null);
  // Censored elapsed time (no usable status timestamp) never warns.
  const unknown = dwellWarning({ baseline, elapsedHours: null });
  assert.equal(unknown.active, false);
});

test("a clearance outlasting the lane's p75 warns with stated evidence", () => {
  const baseline = { available: true, lane: LANE, sample: minDwellSamples, medianHours: 66, p75Hours: 68 };
  const warning = dwellWarning({ baseline, elapsedHours: 90 });
  assert.equal(warning.active, true);
  assert.match(warning.message, /In clearance 3d 18h/);
  assert.match(warning.message, /slow-but-normal is 2d 20h/);
  assert.match(warning.message, /from 3 completed clearances/);
});

test("hours render in human units", () => {
  assert.equal(describeHours(12), "12h");
  assert.equal(describeHours(26), "1d 2h");
  assert.equal(describeHours(72), "3 days");
});
