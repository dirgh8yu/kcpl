import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { shipmentStatuses } from "../app/shipment-types.ts";
import { portalText } from "../app/portal/portal-i18n.ts";
import { portalTrackPosition, portalTrackState, portalTrackStepKeys, portalTrackSteps } from "../app/portal/portal-track.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

test("every status but an exception is a step, in the order KCPL moves a shipment", () => {
  assert.deepEqual([...portalTrackSteps], shipmentStatuses.filter((status) => status !== "exception"));
  portalTrackSteps.forEach((status, index) => assert.equal(portalTrackPosition(status), index));
});

test("an exception claims no step, and neither does a status this build does not know", () => {
  // The record keeps only the current status, so KCPL does not know which
  // stage a held shipment was at; a ringed step would be a guess.
  assert.equal(portalTrackPosition("exception"), -1);
  assert.equal(portalTrackPosition("held_at_port"), -1);
});

test("steps behind are done, the current one is in progress, and delivered is done", () => {
  const states = (status) => portalTrackSteps.map((_, index) => portalTrackState(index, portalTrackPosition(status)));
  assert.deepEqual(states("booking_confirmed"), ["current", "next", "next", "next", "next", "next"]);
  assert.deepEqual(states("customs_clearance"), ["done", "done", "done", "current", "next", "next"]);
  assert.deepEqual(states("delivered"), ["done", "done", "done", "done", "done", "done"]);
});

test("each step has a short name in English and in Nepali", () => {
  for (const step of portalTrackSteps) {
    const key = portalTrackStepKeys[step];
    for (const locale of ["en", "ne"]) {
      const text = portalText(locale, key);
      assert.notEqual(text, key, `${locale} ${key}`);
      assert.ok(text.length <= 18, `${locale} ${key} is too long for a step: ${text}`);
    }
    assert.notEqual(portalText("ne", key), portalText("en", key), `${key} is untranslated`);
  }
  for (const key of ["track.label", "track.done", "track.step_of", "track.next"]) {
    assert.notEqual(portalText("ne", key), portalText("en", key), `${key} is untranslated`);
  }
  assert.equal(portalText("en", "track.step_of", { step: 4, total: 6 }), "Step 4 of 6");
  assert.equal(portalText("en", "track.next", { step: "Out for delivery" }), "Next: Out for delivery");
});

test("the shipment page draws the status as the track, not as a second badge", async () => {
  const page = await readFile(repo("app/portal/shipments/[reference]/page.tsx"), "utf8");
  assert.match(page, /<PortalShipmentTrack status=\{shipment\.status\} locale=\{locale\} note=\{shipment\.customer_note\}\/>/);
  assert.doesNotMatch(page, /portalStatusTone|portalStatusLabel/);
  // On an exception the note is the reason and sits in the alert, once.
  assert.match(page, /shipment\.customer_note && !exception/);
});

test("the track is an ordered list with the current step marked, read once", async () => {
  const view = await readFile(repo("app/portal/portal-shipment-track.tsx"), "utf8");
  assert.match(view, /<ol className="portal-track-steps" aria-label=\{t\("track\.label"\)\}>/);
  assert.match(view, /aria-current=\{index === position \? "step" : undefined\}/);
  // The phone caption and the list bar repeat what the list and the badge say.
  assert.match(view, /className="portal-track-caption" aria-hidden="true"/);
  assert.match(view, /className="portal-track-bar" aria-hidden="true"/);
});

test("progress is drawn where it stands, without motion", async () => {
  const css = await readFile(repo("app/admin/operations-system.css"), "utf8");
  const start = css.indexOf("/* Shipment progress");
  assert.ok(start > -1);
  const track = css.slice(start, css.indexOf("\n}\n", css.indexOf("@media (max-width: 560px)", start)));
  assert.match(track, /\.portal-track-steps/);
  assert.doesNotMatch(track, /transition|animation/);
});

test("both shipment lists put the bar under the status badge", async () => {
  for (const path of ["app/portal/portal-overview.tsx", "app/portal/shipments/portal-shipments-workspace.tsx"]) {
    const source = await readFile(repo(path), "utf8");
    assert.match(source, /<span className="portal-status-stack"><OpsBadge[^>]*>[^<]*<\/OpsBadge><PortalTrackBar status=\{shipment\.status\}\/><\/span>/, path);
  }
});
