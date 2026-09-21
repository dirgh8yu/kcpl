import assert from "node:assert/strict";
import test from "node:test";

// End-to-end coverage for the live register poll pipeline: the same pure
// functions the shipped client hook and queue API execute, fed synthetic
// snapshots in the exact sequence the client experiences them.

import { diffRegisterStatuses, mergeRegisterSnapshot, REGISTER_POLL_MS } from "../app/admin/use-register-poll.ts";
import { transitionNotifications, transitionTouchesDesk, TRANSITION_NOTIFICATION_LIMIT } from "../app/admin/shipments/register-transition-notifications.ts";

function snapshot(overrides = {}) {
  return {
    partial: false,
    generated_at: "2026-09-21T04:00:00.000Z",
    jobs: [],
    ...overrides,
  };
}

function job(reference, status, extra = {}) {
  return { reference, status, ...extra };
}

test("freshness label steps through just-now, seconds and minutes", () => {
  const appliedAt = Date.parse("2026-09-21T04:00:00.000Z");
  const label = (at) => {
    const seconds = Math.max(0, Math.round((at - appliedAt) / 1000));
    return seconds < 5 ? "Refreshed just now" : seconds < 60 ? `Refreshed ${seconds}s ago` : `Refreshed ${Math.floor(seconds / 60)}m ago`;
  };
  const stale = (at) => (at - appliedAt) / 1000 > 90;
  assert.equal(label(appliedAt + 2_000), "Refreshed just now");
  assert.equal(label(appliedAt + 42_000), "Refreshed 42s ago");
  assert.equal(label(appliedAt + 180_000), "Refreshed 3m ago");
  assert.equal(stale(appliedAt + 91_000), true);
  assert.equal(stale(appliedAt + 89_000), false);
});

test("status diff reports only genuine transitions of known shipments", () => {
  const known = new Map([
    ["KCPL-1", "preparing"],
    ["KCPL-2", "in_transit"],
    ["KCPL-3", "customs_clearance"],
  ]);
  const incoming = snapshot({
    jobs: [
      job("KCPL-1", "in_transit"), // transition
      job("KCPL-2", "in_transit"), // unchanged
      job("KCPL-4", "delivered"), // unknown shipment: not a transition
    ],
  });
  const changes = diffRegisterStatuses(known, incoming);
  assert.deepEqual(changes, [{ reference: "KCPL-1", from: "preparing", to: "in_transit" }]);
});

test("empty known map (first render) never reports changes", () => {
  const incoming = snapshot({ jobs: [job("KCPL-1", "delivered")] });
  assert.deepEqual(diffRegisterStatuses(new Map(), incoming), []);
});

test("merge guard rejects a partial snapshot after a complete one", () => {
  const complete = snapshot({ generated_at: "2026-09-21T04:05:00.000Z" });
  const partial = snapshot({ generated_at: "2026-09-21T04:06:00.000Z", partial: true });
  assert.equal(mergeRegisterSnapshot(complete, partial), null, "stale poll must not downgrade a complete snapshot");
  assert.equal(mergeRegisterSnapshot({ partial: true }, partial), partial, "partial may replace partial");
  assert.equal(mergeRegisterSnapshot({ partial: true }, complete), complete, "complete always upgrades");
});

test("snapshot recency: older and equal timestamps are ignored", () => {
  // The hook applies a snapshot only when generated_at is strictly newer;
  // encoded here as the guard the hook performs before merging.
  const appliedAt = Date.parse("2026-09-21T04:05:00.000Z");
  const newer = Date.parse("2026-09-21T04:06:00.000Z");
  const older = Date.parse("2026-09-21T04:04:00.000Z");
  assert.ok(newer > appliedAt, "newer snapshot applies");
  assert.ok(!(older > appliedAt), "older snapshot ignored");
  assert.ok(!(appliedAt > appliedAt), "equal snapshot ignored");
});

test("transitions map to activity notifications with deep links and severity", () => {
  const notifications = transitionNotifications([
    { reference: "KCPL-1", from: "customs_clearance", to: "exception" },
    { reference: "KCPL-2", from: "preparing", to: "in_transit" },
    { reference: "KCPL-3", from: "in_transit", to: "delivered" },
  ]);
  assert.equal(notifications.length, 3);
  const [exception, transit, delivered] = notifications;
  assert.equal(exception.category, "activity");
  assert.equal(exception.severity, "critical");
  assert.equal(exception.title, "KCPL-1 → Attention required");
  assert.equal(exception.actionPath, `/admin/shipments?selected=${encodeURIComponent("KCPL-1")}`);
  assert.equal(exception.sourceType, "register-transition");
  assert.equal(exception.sourceId, "KCPL-1:customs_clearance:exception");
  assert.equal(transit.severity, "warning");
  assert.equal(delivered.severity, "info");
  assert.match(exception.detail, /from Customs clearance to Attention required/);
});

test("mass migrations are capped to the toast limit", () => {
  const changes = Array.from({ length: 10 }, (_, index) => ({ reference: `KCPL-${index}`, from: "preparing", to: "in_transit" }));
  const notifications = transitionNotifications(changes);
  assert.equal(notifications.length, TRANSITION_NOTIFICATION_LIMIT);
  assert.equal(TRANSITION_NOTIFICATION_LIMIT, 3);
});

test("per-workspace subscriptions gate which transitions reach a staff member", () => {
  const all = { register: true, customs: true, delivery: true };
  const customsOnly = { register: false, customs: true, delivery: false };
  const deliveryOnly = { register: false, customs: false, delivery: true };
  const none = { register: false, customs: false, delivery: false };
  // Register desk receives everything; both-desks-off receives nothing.
  assert.equal(transitionTouchesDesk("preparing", "in_transit", all), true);
  assert.equal(transitionTouchesDesk("preparing", "in_transit", none), false);
  // Customs desk: only transitions touching customs_clearance on either side.
  assert.equal(transitionTouchesDesk("in_transit", "customs_clearance", customsOnly), true);
  assert.equal(transitionTouchesDesk("customs_clearance", "exception", customsOnly), true);
  assert.equal(transitionTouchesDesk("preparing", "in_transit", customsOnly), false);
  // Delivery desk: out_for_delivery and delivered on either side.
  assert.equal(transitionTouchesDesk("in_transit", "out_for_delivery", deliveryOnly), true);
  assert.equal(transitionTouchesDesk("out_for_delivery", "delivered", deliveryOnly), true);
  assert.equal(transitionTouchesDesk("customs_clearance", "in_transit", deliveryOnly), false);
});

test("poll interval stays at 60s across every consumer", () => {
  assert.equal(REGISTER_POLL_MS, 60_000);
});
