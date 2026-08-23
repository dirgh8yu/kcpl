import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const productionPathspec = [":!tests", ":!docs", ":!node_modules", ":!.next", ":!.git"];
const categories = ["A", "B", "C", "D", "E"];

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function gitGrep(args) {
  try {
    const output = execFileSync("git", ["grep", "-n", ...args], { cwd: root, encoding: "utf8" }).trim();
    return output ? output.split("\n") : [];
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 1) return [];
    throw error;
  }
}

function gitGrepFiles(args) {
  try {
    const output = execFileSync("git", ["grep", "-l", ...args], { cwd: root, encoding: "utf8" }).trim();
    return output ? output.split("\n") : [];
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 1) return [];
    throw error;
  }
}

function fileOf(match) {
  const index = match.indexOf(":");
  return index === -1 ? match : match.slice(0, index);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function source(path) {
  return readFileSync(`${root}/${path}`, "utf8");
}

function matchesInFiles(matches, files) {
  const allowed = new Set(files);
  return matches.filter((match) => allowed.has(fileOf(match)));
}

function witness(match, reason) {
  const first = match.indexOf(":");
  const second = first === -1 ? -1 : match.indexOf(":", first + 1);
  return {
    file: first === -1 ? match : match.slice(0, first),
    line: second === -1 ? null : Number(match.slice(first + 1, second)),
    signature: second === -1 ? match : match.slice(second + 1).trim(),
    reason,
  };
}

function formatCandidate(candidate) {
  const details = candidate.witnesses
    .slice(0, 8)
    .map((item) => `  ${item.file}:${item.line ?? "?"} | reason=${item.reason} | signature=${item.signature}`)
    .join("\n");
  return `${candidate.file}\n${details}`;
}

const reviewedClassifications = [
  {
    file: "app/admin/delivery/canonical-delivery-authority.server.ts",
    category: "C",
    rationale: "Shared #133 transaction authority is the only normal operational writer allowed to produce canonical Delivered and decrement/increment customer completion counters.",
  },
  {
    file: "app/shipment-data.server.ts",
    category: "C",
    rationale: "Generic updateShipment explicitly rejects entering Delivered and treats canonical Delivered as terminal.",
  },
  {
    file: "app/api/admin/shipments/[reference]/route.ts",
    category: "C",
    rationale: "Direct admin Delivered requests delegate to reconcileCanonicalDelivery; non-Delivered updates use the guarded updateShipment path.",
  },
  {
    file: "app/admin/delivery/delivery-control.server.ts",
    category: "A",
    rationale: "Delivery Control records physical attempt/POD evidence only; completion requests delegate to the shared canonical authority.",
  },
  {
    file: "app/admin/visibility/external-workflow-state.ts",
    category: "B",
    rationale: "External milestone policy treats provider Delivered as an observation/candidate and requires the canonical delivery decision before promotion.",
  },
  {
    file: "app/admin/visibility/tracking-visibility.server.ts",
    category: "C",
    rationale: "Provider reconciliation persists observations and invokes writeCanonicalDeliveryCompletionInTransaction for Delivered instead of independently writing status Delivered.",
  },
  {
    file: "app/admin/migration/shipment-import.server.ts",
    category: "E",
    rationale: "Stage-2 historical import may create already-completed historical records, but duplicate existing shipment references are excluded and Firestore create is used, so it cannot transition an existing operational shipment around #133.",
  },
  {
    file: "app/shipment-documents.server.ts",
    category: "A",
    rationale: "Shipment document/POD persistence is evidence authority only and does not independently own canonical Delivered.",
  },
  {
    file: "app/admin/workflow-guard.server.ts",
    category: "C",
    rationale: "Workflow transition policy is a guard around operational status changes and does not provide an alternate canonical Delivered writer.",
  },
];

const expectedReviewedSurfaces = [
  {
    id: "central canonical Delivered transaction writer",
    file: "app/admin/delivery/canonical-delivery-authority.server.ts",
    patterns: [
      /function writeCanonicalDeliveryCompletionInTransaction/,
      /transaction\.update\(facts\.shipmentRef, \{[\s\S]{0,160}status: "delivered"/,
    ],
  },
  {
    id: "customer completion counters inside central authority",
    file: "app/admin/delivery/canonical-delivery-authority.server.ts",
    patterns: [
      /active_shipment_count: Math\.max\(0, active - 1\)/,
      /completed_shipment_count: completed \+ 1/,
    ],
  },
  {
    id: "direct Delivered PATCH delegation",
    file: "app/api/admin/shipments/[reference]/route.ts",
    patterns: [
      /if \(status === "delivered"\)/,
      /reconcileCanonicalDelivery\(reference, \{[\s\S]{0,220}source: "direct_admin_request"/,
    ],
  },
  {
    id: "generic updateShipment Delivered protection",
    file: "app/shipment-data.server.ts",
    patterns: [
      /currentStatus !== "delivered" && values\.status === "delivered"[\s\S]{0,100}canonical_delivery_authority_required/,
      /currentStatus === "delivered" && values\.status !== "delivered"[\s\S]{0,100}terminal_delivered/,
    ],
  },
  {
    id: "Delivery Control physical evidence delegation",
    file: "app/admin/delivery/delivery-control.server.ts",
    patterns: [
      /input\.status === "delivered"[\s\S]{0,180}reconcileCanonicalDelivery/,
      /source: "manual_delivery"/,
    ],
  },
  {
    id: "POD verification reconciliation",
    file: "app/admin/delivery/delivery-control.server.ts",
    patterns: [
      /source: "pod_verification"/,
      /reconcileCanonicalDelivery/,
    ],
  },
  {
    id: "external Delivered observation policy",
    file: "app/admin/visibility/external-workflow-state.ts",
    patterns: [
      /milestone === "delivered"\) return "delivered"/,
      /if \(targetStatus === "delivered"\)[\s\S]{0,260}canonical_delivery_authority_required/,
    ],
  },
  {
    id: "external provider canonical delegation",
    file: "app/admin/visibility/tracking-visibility.server.ts",
    patterns: [
      /promotion\.targetStatus === "delivered"[\s\S]{0,400}writeCanonicalDeliveryCompletionInTransaction/,
      /canonicalAfter !== "delivered"\) update\.status = canonicalAfter/,
    ],
  },
  {
    id: "tracked-delivery adoption remains evidence-first",
    file: "app/admin/delivery/delivery-control.server.ts",
    patterns: [
      /function adoptTrackedDelivery|function adoptTrackedDelivery|export async function adoptTrackedDelivery/,
      /source: "manual_delivery"/,
    ],
  },
  {
    id: "historical import cannot overwrite existing operational shipment",
    file: "app/admin/migration/shipment-import.server.ts",
    patterns: [
      /recordClass === "historical"[\s\S]{0,260}shipmentStatus !== "delivered"/,
      /existing\.byReference\.has\(reference\)/,
      /write\.create\(shipmentRef, \{ \.\.\.shipmentDocument/,
    ],
  },
];

for (const review of reviewedClassifications) {
  assert.ok(categories.includes(review.category), `Invalid reviewed category ${review.category} for ${review.file}`);
}

test("repository-wide canonical Delivered writer inventory fails closed", () => {
  const head = git(["rev-parse", "HEAD"]);
  const trackedFiles = git(["ls-files"]).split("\n").filter(Boolean);

  const delivered = gitGrep(["-i", "delivered", "--", ...productionPathspec]);
  const directStatusDelivered = gitGrep([
    "-E",
    "(^|[^[:alnum:]_])status[[:space:]]*:[[:space:]]*[\"']delivered[\"']|(^|[^[:alnum:]_])status[[:space:]]*=[[:space:]]*[\"']delivered[\"']",
    "--",
    ...productionPathspec,
  ]);
  const indirectDeliveredStatus = gitGrep([
    "-E",
    "(nextShipmentStatus|targetStatus|newStatus|canonicalStatus|canonicalAfter|shipmentStatusForDelivery)[[:space:]]*[:=][[:space:]]*[\"']delivered[\"']",
    "--",
    ...productionPathspec,
  ]);
  const statusFlowNames = gitGrep([
    "-E",
    "nextShipmentStatus|targetStatus|newStatus|canonicalStatus|canonicalAfter|shipmentStatusForDelivery|shipmentStatus|shipment_status",
    "--",
    ...productionPathspec,
  ]);
  const shipmentStatusType = gitGrep(["ShipmentStatus", "--", ...productionPathspec]);
  const updateShipmentCalls = gitGrep(["-F", "updateShipment(", "--", ...productionPathspec]);
  const canonicalWriterCalls = gitGrep(["-F", "writeCanonicalDeliveryCompletionInTransaction(", "--", ...productionPathspec]);
  const customerCounters = gitGrep([
    "-E",
    "completed_shipment_count|completedShipmentCount",
    "--",
    ...productionPathspec,
  ]);
  const incrementCalls = gitGrep([
    "-E",
    "FieldValue\\.increment|firestore\\.FieldValue\\.increment|increment\\(",
    "--",
    ...productionPathspec,
  ]);
  const spreadPayloads = gitGrep([
    "-E",
    "\\.\\.\\.(input|body|patch|updates|payload)",
    "--",
    ...productionPathspec,
  ]);
  const genericWrites = gitGrep([
    "-E",
    "transaction\\.(update|set|create)|batch\\.(update|set|create)|write\\.(update|set|create)|\\.update\\(|\\.set\\(|\\.create\\(",
    "--",
    ...productionPathspec,
  ]);

  const shipmentPersistenceFiles = unique(gitGrepFiles([
    "-E",
    "collection\\([\"']shipments[\"']\\)|facts\\.shipmentRef|scope\\.ref|shipmentRef",
    "--",
    ...productionPathspec,
  ]));

  const candidateFiles = unique([
    ...delivered.map(fileOf),
    ...customerCounters.map(fileOf),
    ...updateShipmentCalls.map(fileOf),
    ...canonicalWriterCalls.map(fileOf),
    ...spreadPayloads.map(fileOf),
    ...statusFlowNames.map(fileOf),
    ...shipmentStatusType.map(fileOf),
  ].filter((path) => shipmentPersistenceFiles.includes(path)));

  const witnessGroups = [
    [directStatusDelivered, "direct status Delivered assignment"],
    [indirectDeliveredStatus, "indirect Delivered status flow"],
    [updateShipmentCalls, "generic updateShipment call"],
    [canonicalWriterCalls, "shared canonical Delivered writer call"],
    [customerCounters, "customer completion counter reference"],
    [spreadPayloads, "spread payload into production mutation surface"],
    [statusFlowNames, "shipment status flow variable"],
    [shipmentStatusType, "ShipmentStatus-bearing persistence surface"],
    [genericWrites, "generic persistence write in candidate file"],
    [incrementCalls, "counter increment in candidate file"],
  ];

  const candidates = candidateFiles.map((file) => {
    const witnesses = witnessGroups.flatMap(([matches, reason]) => matchesInFiles(matches, [file]).map((match) => witness(match, reason)));
    return { file, witnesses };
  });

  const classified = candidates.map((candidate) => {
    const reviews = reviewedClassifications.filter((review) => review.file === candidate.file);
    return { ...candidate, reviews };
  });
  const unknown = classified.filter((candidate) => candidate.reviews.length === 0);
  const multiple = classified.filter((candidate) => candidate.reviews.length > 1);
  const categoryD = classified.filter((candidate) => candidate.reviews.length === 1 && candidate.reviews[0].category === "D");

  const missingExpected = expectedReviewedSurfaces.flatMap((expected) => {
    let text;
    try {
      text = source(expected.file);
    } catch (error) {
      return [{ ...expected, reason: error instanceof Error ? error.message : "file could not be read" }];
    }
    const missingPatterns = expected.patterns.filter((pattern) => !pattern.test(text)).map((pattern) => String(pattern));
    return missingPatterns.length ? [{ ...expected, reason: `missing signature(s): ${missingPatterns.join(", ")}` }] : [];
  });

  const categoryCounts = Object.fromEntries(categories.map((category) => [
    category,
    classified.filter((candidate) => candidate.reviews.length === 1 && candidate.reviews[0].category === category).length,
  ]));

  const inventory = {
    head,
    tracked_file_count: trackedFiles.length,
    production_delivered_match_count: delivered.length,
    shipment_persistence_file_count: shipmentPersistenceFiles.length,
    candidate_count: candidates.length,
    candidates: classified.map((candidate) => ({
      file: candidate.file,
      category: candidate.reviews.length === 1 ? candidate.reviews[0].category : null,
      rationale: candidate.reviews.length === 1 ? candidate.reviews[0].rationale : null,
      witnesses: candidate.witnesses,
    })),
    category_counts: categoryCounts,
    category_d_count: categoryD.length,
    unknown_count: unknown.length,
    multiple_count: multiple.length,
    missing_expected_count: missingExpected.length,
    missing_expected: missingExpected.map((item) => ({ id: item.id, file: item.file, reason: item.reason })),
  };

  console.log("KCPL_CANONICAL_DELIVERY_WRITER_INVENTORY_BEGIN");
  console.log(JSON.stringify(inventory, null, 2));
  console.log("KCPL_CANONICAL_DELIVERY_WRITER_INVENTORY_END");
  console.log(`KCPL_CANONICAL_DELIVERY_GATE Category D=${categoryD.length} unknown=${unknown.length} multiple=${multiple.length} missing expected=${missingExpected.length}`);

  assert.match(head, /^[0-9a-f]{40}$/);
  assert.ok(trackedFiles.length > 0, "tracked checkout unexpectedly empty");
  assert.ok(delivered.length > 0, "production Delivered search unexpectedly empty");
  assert.ok(candidates.length > 0, "canonical Delivered candidate universe unexpectedly empty");

  assert.equal(
    unknown.length,
    0,
    `Unclassified production mutation candidate(s):\n${unknown.map(formatCandidate).join("\n\n")}`,
  );
  assert.equal(
    multiple.length,
    0,
    `Production mutation candidate(s) mapped to multiple A/B/C/D/E classes:\n${multiple.map((candidate) => `${formatCandidate(candidate)}\n  classes=${candidate.reviews.map((review) => review.category).join(",")}`).join("\n\n")}`,
  );
  assert.equal(
    missingExpected.length,
    0,
    `Expected reviewed authority candidate missing:\n${missingExpected.map((item) => `  ${item.id} | ${item.file} | ${item.reason}`).join("\n")}`,
  );
  assert.equal(
    categoryD.length,
    0,
    `Category D alternate canonical Delivered authority detected:\n${categoryD.map(formatCandidate).join("\n\n")}`,
  );
});
