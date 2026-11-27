import assert from "node:assert/strict";
import test from "node:test";
import { anyCorridor, corridorOptions, filterQuotesByCorridor } from "../app/admin/enquiry-corridor.ts";

/* The corridor filter has to open exactly the enquiries the lead-source rollup
 * counted for that lane, so it matches the stored slug and nothing else. */

const inbox = [
  { reference: "QT-1", lane_slug: "nepal-to-tibet" },
  { reference: "QT-2", lane_slug: null },
  { reference: "QT-3", lane_slug: "nepal-to-tibet" },
  { reference: "QT-4", lane_slug: "kolkata-to-birgunj" },
  { reference: "QT-5", lane_slug: "" },
];

test("the filter offers each corridor in the inbox once, in a stable order", () => {
  assert.deepEqual(corridorOptions(inbox), ["kolkata-to-birgunj", "nepal-to-tibet"]);
  assert.deepEqual(corridorOptions([]), []);
  assert.deepEqual(corridorOptions([{ reference: "QT-9", lane_slug: null }]), []);
});

test("filtering by a corridor returns that corridor's enquiries", () => {
  const rows = filterQuotesByCorridor(inbox, "nepal-to-tibet");
  assert.deepEqual(rows.map((row) => row.reference), ["QT-1", "QT-3"]);
  assert.deepEqual(filterQuotesByCorridor(inbox, "kolkata-to-birgunj").map((row) => row.reference), ["QT-4"]);
  assert.deepEqual(filterQuotesByCorridor(inbox, "kathmandu-to-lhasa").map((row) => row.reference), []);
});

test("clearing the filter leaves the inbox exactly as loaded", () => {
  assert.equal(filterQuotesByCorridor(inbox, anyCorridor), inbox);
  assert.equal(filterQuotesByCorridor(inbox, ""), inbox);
});
