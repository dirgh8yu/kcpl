import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const productionPathspec = [":!tests", ":!docs", ":!node_modules", ":!.next", ":!.git"];

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

test("repository-wide canonical Delivered writer inventory is generated from the full tracked checkout", () => {
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
  const customerCounters = gitGrep([
    "-E",
    "completed_shipment_count|active_shipment_count|completedShipmentCount|activeShipmentCount",
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
    ...spreadPayloads.map(fileOf),
    ...statusFlowNames.map(fileOf),
    ...shipmentStatusType.map(fileOf),
  ].filter((path) => shipmentPersistenceFiles.includes(path)));

  const mutationCapableMatches = unique([
    ...matchesInFiles(directStatusDelivered, shipmentPersistenceFiles),
    ...matchesInFiles(indirectDeliveredStatus, shipmentPersistenceFiles),
    ...matchesInFiles(updateShipmentCalls, shipmentPersistenceFiles),
    ...matchesInFiles(customerCounters, shipmentPersistenceFiles),
    ...matchesInFiles(spreadPayloads, shipmentPersistenceFiles),
    ...matchesInFiles(statusFlowNames, shipmentPersistenceFiles),
    ...matchesInFiles(shipmentStatusType, shipmentPersistenceFiles),
  ]);
  const candidateGenericWrites = matchesInFiles(genericWrites, candidateFiles);
  const candidateIncrementCalls = matchesInFiles(incrementCalls, candidateFiles);

  const inventory = {
    head,
    tracked_file_count: trackedFiles.length,
    production_delivered_match_count: delivered.length,
    production_delivered_matches: delivered,
    direct_status_delivered_matches: directStatusDelivered,
    indirect_delivered_status_matches: indirectDeliveredStatus,
    shipment_persistence_files: shipmentPersistenceFiles,
    candidate_files: candidateFiles,
    mutation_capable_match_count: mutationCapableMatches.length,
    mutation_capable_matches: mutationCapableMatches,
    customer_counter_matches: customerCounters,
    update_shipment_matches: updateShipmentCalls,
    spread_payload_matches: spreadPayloads,
    candidate_increment_matches: candidateIncrementCalls,
    candidate_generic_write_matches: candidateGenericWrites,
  };

  console.log("KCPL_CANONICAL_DELIVERY_WRITER_INVENTORY_BEGIN");
  console.log(JSON.stringify(inventory, null, 2));
  console.log("KCPL_CANONICAL_DELIVERY_WRITER_INVENTORY_END");

  const authority = source("app/admin/delivery/canonical-delivery-authority.server.ts");
  const shipmentData = source("app/shipment-data.server.ts");
  assert.match(head, /^[0-9a-f]{40}$/);
  assert.ok(trackedFiles.length > 0);
  assert.ok(delivered.length > 0);
  assert.match(authority, /transaction\.update\(facts\.shipmentRef, \{[\s\S]{0,120}status: "delivered"/);
  assert.match(shipmentData, /currentStatus !== "delivered" && values\.status === "delivered"[\s\S]{0,100}canonical_delivery_authority_required/);
  assert.match(shipmentData, /currentStatus === "delivered" && values\.status !== "delivered"[\s\S]{0,100}terminal_delivered/);
});
