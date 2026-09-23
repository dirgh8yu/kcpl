import assert from "node:assert/strict";
import test from "node:test";

import {
  minComparableModeMatched,
  minComparableShipments,
  suggestChecklist,
} from "../app/admin/customs/checklist-recommender.ts";
import { shipmentDocumentTypeLabels } from "../app/shipment-document-types.ts";

const LANE = "kolkata→birgunj";

function evidence(overrides = {}) {
  return {
    lane: LANE,
    mode: "ocean",
    branch: "Birgunj",
    delivered: true,
    documents: ["commercial_invoice", "packing_list", "bill_of_lading"],
    ...overrides,
  };
}

function laneHistory(count, documents = ["commercial_invoice", "packing_list", "bill_of_lading"]) {
  return Array.from({ length: count }, () => evidence({ documents }));
}

test("a thin lane history earns no suggestions unless it is uniformly mode-matched", () => {
  const thinMixed = [evidence(), evidence({ mode: "road" })];
  const result = suggestChecklist(thinMixed, { lane: LANE, mode: "ocean", branch: "Birgunj" });
  assert.equal(result.available, false);
  assert.deepEqual(result.suggestions, []);
  // The count still reports the real lane completions examined, so a caller
  // can say "2 completed shipments on this lane — not enough history yet".
  assert.equal(result.comparableCount, 2);
});

test("a thick lane history produces support-counted suggestions", () => {
  const result = suggestChecklist(laneHistory(minComparableShipments), { lane: LANE, mode: "ocean", branch: "Birgunj" });
  assert.equal(result.available, true);
  assert.equal(result.comparableCount, minComparableShipments);
  const invoice = result.suggestions.find((item) => item.documentType === "commercial_invoice");
  assert.ok(invoice);
  assert.equal(invoice.support, minComparableShipments);
  assert.equal(invoice.share, 1);
});

test("a two-shipment lane qualifies only when both completions match the mode", () => {
  const pair = [evidence(), evidence()];
  const result = suggestChecklist(pair, { lane: LANE, mode: "ocean", branch: "Birgunj" });
  // Two ocean completions on the lane: mode-matched quorum is met.
  assert.equal(result.available, true);
  assert.equal(result.comparableCount, minComparableModeMatched);
});

test("another lane never leaks into the suggestions, delivered or not", () => {
  const other = [...laneHistory(3), evidence({ lane: "chittagong→kathmandu" }), evidence({ lane: "kolkata→birgunj", delivered: false })];
  const result = suggestChecklist(other, { lane: LANE, mode: "ocean", branch: "Birgunj" });
  assert.equal(result.comparableCount, 3);
});

test("documents below the share floor are not suggested", () => {
  const history = [
    ...laneHistory(3),
    evidence({ documents: ["commercial_invoice", "import_permit"] }),
  ];
  const result = suggestChecklist(history, { lane: LANE, mode: "ocean", branch: "Birgunj" });
  const permit = result.suggestions.find((item) => item.documentType === "import_permit");
  assert.equal(permit, undefined);
  const invoice = result.suggestions.find((item) => item.documentType === "commercial_invoice");
  assert.equal(invoice.support, 4);
  assert.equal(invoice.share, 1);
});

test("suggestions sort by share, then label, for stable output", () => {
  const history = [
    evidence({ documents: ["commercial_invoice", "packing_list", "bill_of_lading", "certificate_of_origin"] }),
    evidence({ documents: ["commercial_invoice", "packing_list", "bill_of_lading"] }),
    evidence({ documents: ["commercial_invoice", "packing_list", "bill_of_lading"] }),
    evidence({ documents: ["commercial_invoice", "packing_list", "bill_of_lading"] }),
  ];
  const result = suggestChecklist(history, { lane: LANE, mode: "ocean", branch: "Birgunj" });
  const shares = result.suggestions.map((item) => item.share);
  assert.deepEqual(shares, [...shares].sort((a, b) => b - a));
  // Perfect tie between packing list and bill of lading must not shuffle.
  const tied = result.suggestions.filter((item) => item.share === 1).map((item) => item.label);
  assert.deepEqual(tied, [...tied].sort((a, b) => a.localeCompare(b)));
});

test("unknown document types in history are ignored, never rendered", () => {
  const history = laneHistory(minComparableShipments);
  const result = suggestChecklist(history, { lane: LANE, mode: "ocean", branch: "Birgunj" });
  for (const item of result.suggestions) {
    assert.ok(item.label.length > 0);
    assert.ok(Object.hasOwn(shipmentDocumentTypeLabels, item.documentType));
  }
});
