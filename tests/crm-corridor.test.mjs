import assert from "node:assert/strict";
import test from "node:test";
import { customerCorridorFromQuote } from "../app/admin/crm/crm-corridor.ts";

/* A converted enquiry hands its corridor and source to the customer record, so
 * per-corridor win rate is readable from customer data. Older quotes carry the
 * lane path only inside the attribution block; both resolve to the same lane. */

test("a lane enquiry carries its corridor and source onto the customer", () => {
  const corridor = customerCorridorFromQuote({
    lane_slug: "nepal-to-tibet",
    lane_origin: "Kathmandu",
    lane_destination: "Lhasa",
    attribution: { source: "lane" },
  });
  assert.deepEqual(corridor, {
    laneSlug: "nepal-to-tibet",
    laneOrigin: "Kathmandu",
    laneDestination: "Lhasa",
    enquirySource: "lane",
  });
});

test("a quote written before the slug sat on the record resolves from the lane path", () => {
  const corridor = customerCorridorFromQuote({ attribution: { source: "lane", lane_path: "/ne/lanes/nepal-to-tibet" } });
  assert.equal(corridor.laneSlug, "nepal-to-tibet");
  assert.equal(corridor.laneOrigin, "Kathmandu");
  assert.equal(corridor.laneDestination, "Lhasa");
  assert.equal(corridor.enquirySource, "lane");
});

test("the corridor's cities come from the lane copy, not the visitor's words", () => {
  const corridor = customerCorridorFromQuote({ lane_slug: "nepal-to-tibet", lane_origin: "काठमाडौं", attribution: { source: "lane" } });
  assert.equal(corridor.laneOrigin, "काठमाडौं");
  const fromPath = customerCorridorFromQuote({ attribution: { lane_path: "/ne/lanes/nepal-to-tibet" } });
  assert.equal(fromPath.laneOrigin, "Kathmandu");
});

test("a quote with no corridor keeps its source and invents no lane", () => {
  const corridor = customerCorridorFromQuote({ attribution: { source: "direct" } });
  assert.deepEqual(corridor, { laneSlug: null, laneOrigin: null, laneDestination: null, enquirySource: "direct" });
  const index = customerCorridorFromQuote({ lane_slug: "not-a-lane", attribution: { source: "lane", lane_path: "/lanes" } });
  assert.equal(index.laneSlug, null);
  assert.equal(index.enquirySource, "lane");
  assert.equal(customerCorridorFromQuote({}).laneSlug, null);
});
