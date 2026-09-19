import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const productionPathspec = [":!tests", ":!docs", ":!node_modules", ":!.next", ":!.git"];

// Canonical Delivered writer classes. Every production module that touches shipment
// persistence is reviewed into exactly one of these.
//
// A - Subordinate authority. Writes shipment-linked evidence or operational sub-state
//     (delivery attempts, POD, documents, pickups, tasks, alerts, job-file metadata,
//     derived aggregates) and never assigns the canonical shipment `status`.
// B - External observation policy. Provider/machine movement is classified as an
//     observation or candidate and cannot promote canonical state on its own.
// C - Guarded canonical path. An operational or canonical writer that either delegates
//     to the shared #133 authority or provably cannot enter canonical Delivered.
// D - Alternate canonical Delivered authority. MUST remain empty; this is the gate.
// E - Historical / migration / recovery surface. May create or recompute records that
//     are already in a completed historical state, or roll back a migration batch, but
//     cannot transition an existing operational shipment around the authority.
// F - Read-only projection or pure module. No Firestore mutation statement against
//     shipment persistence at all; enforced mechanically by readOnlyMutationPatterns.
const categories = ["A", "B", "C", "D", "E", "F"];

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
  {
    file: "app/admin/crm/crm-quote-links.server.ts",
    category: "C",
    rationale: "Relinking a shipment to a different CRM customer moves that customer's active/completed counters by reading the current canonical shipment status inside one transaction; it never assigns canonical status, so completion counters stay derived from the single Delivered authority.",
  },
  {
    file: "app/admin/tenders/tms-tendering.server.ts",
    category: "C",
    rationale: "TMS booking creates a new shipment document fixed at status booking_confirmed and increments the customer active counter; the module exposes no path that can create or transition a shipment into canonical Delivered.",
  },
  {
    file: "app/admin/migration/recovery/recovery.server.ts",
    category: "E",
    rationale: "Rolls back records created by one explicit migration batch and recounts customer active/completed counters from each shipment's canonical status; it deletes and recounts rather than transitioning an operational shipment around the authority.",
  },
  {
    file: "app/admin/alerts/alert-engine.server.ts",
    category: "A",
    rationale: "Automation writes alert documents and a customer credit-hold account_status only; shipment status is read to build alert candidates and is never assigned.",
  },
  {
    file: "app/admin/alerts/freight-automation.server.ts",
    category: "A",
    rationale: "Freight-ops automation writes alert documents and auto-generated job tasks only; shipment status is read for classification and is never assigned.",
  },
  {
    file: "app/admin/freight-documents/freight-documents.server.ts",
    category: "A",
    rationale: "Generated freight-document persistence supersedes the prior revision and increments the shipment generated-document counter; no canonical status field is written.",
  },
  {
    file: "app/admin/job-file.server.ts",
    category: "A",
    rationale: "Digital Job File writes one fixed metadata update (assignment, priority, internal reference/notes, management branch) built from explicit literal keys; no status field can enter the update object.",
  },
  {
    file: "app/admin/pickups/pickup-appointments.server.ts",
    category: "A",
    rationale: "Pickup scheduling writes the appointment document plus pickup_* projection fields on the shipment and records tracking observations; canonical shipment status is never written.",
  },
  {
    file: "app/admin/command-centre/command-centre.server.ts",
    category: "F",
    rationale: "Operations Overview read model; shipment status values are normalized for display only.",
  },
  {
    file: "app/admin/crm/crm-operations-history.server.ts",
    category: "F",
    rationale: "Read-only CRM operations history projection over quotes and shipments.",
  },
  {
    file: "app/admin/customs/customs-data.server.ts",
    category: "F",
    rationale: "Read model over customs_steps and document requirements; status values are coerced for display only.",
  },
  {
    file: "app/admin/documents/documents-data.server.ts",
    category: "F",
    rationale: "Read model projecting shipment_status from the stored shipment document for the documents workspace.",
  },
  {
    file: "app/admin/edi/edi-x12.ts",
    category: "F",
    rationale: "Pure X12 204/990/214 parser and serializer with no Firestore dependency at all.",
  },
  {
    file: "app/admin/management/management.server.ts",
    category: "F",
    rationale: "Management reporting aggregation over shipments, orders and finance; builds in-memory maps only.",
  },
  {
    file: "app/admin/notifications/assignment-notifications.server.ts",
    category: "F",
    rationale: "Builds the staff assignment notification feed from shipment/task reads plus stored receipts; returns a projection and writes nothing.",
  },
  {
    file: "app/admin/partners/partner-360.server.ts",
    category: "F",
    rationale: "Partner 360 read model over partners, bills and shipments.",
  },
  {
    file: "app/admin/shipment-activity.server.ts",
    category: "F",
    rationale: "Shipment activity/audit read model that assembles existing events and activity documents.",
  },
  {
    file: "app/admin/workload/[key]/page.tsx",
    category: "F",
    rationale: "Workload page component; reads and renders shipment status labels only.",
  },
  {
    file: "app/api/admin/search/route.ts",
    category: "F",
    rationale: "Operations search read route with an in-process index cache; status values are labeled for the result list.",
  },
  {
    file: "app/api/gpt/briefing/route.ts",
    category: "F",
    rationale: "Read-only Custom GPT action gateway; returns an operational briefing payload.",
  },
  {
    file: "app/api/gpt/delivery/route.ts",
    category: "F",
    rationale: "Read-only Custom GPT action gateway; projects delivery state from stored attempt and POD evidence.",
  },
  {
    file: "app/api/gpt/freight-documents/route.ts",
    category: "F",
    rationale: "Read-only Custom GPT action gateway over generated freight documents.",
  },
  {
    file: "app/api/gpt/pickups/route.ts",
    category: "F",
    rationale: "Read-only Custom GPT action gateway over pickup appointments.",
  },
  {
    file: "app/portal/portal-access-policy.ts",
    category: "F",
    rationale: "Pure customer-portal decision module with no Firebase dependency at all; the ShipmentStatus set it holds classifies a status as active for a customer-facing count and never assigns one.",
  },
  {
    file: "app/portal/portal-notifications.server.ts",
    category: "A",
    rationale: "Customer notification sweep. Reads canonical shipment status and writes only its own records: a delivery row per outbound email in portal_email_deliveries, and a per-shipment notification watermark in portal_notification_state. It never writes the shipment document, so it cannot assign or influence canonical status -- reading the result on a schedule is precisely what keeps notifications outside the delivery authority.",
  },
  {
    file: "app/portal/portal-data.server.ts",
    category: "F",
    rationale: "Read model behind the customer portal. Every Firestore call is a get; shipment_status is projected onto a document row for display, and the .set() calls the scan sees are in-memory Map writes used to group balances and de-duplicate quotes.",
  },
];

// Class F is falsifiable: a read-only module must contain no mutation statement that
// could reach shipment persistence. Any of these appearing means the module is a
// writer and must be reclassified into A/B/C/E.
const readOnlyMutationPatterns = [
  /(?:transaction|batch|write)\.(?:update|set|create|delete)\(/,
  /\.doc\([^)]*\)\.(?:update|set|create|delete)\(/,
  /\b(?:shipmentRef|scope\.ref|facts\.shipmentRef|ref)\.(?:update|set|create|delete)\(/,
];

const expectedReviewedSurfaces = [
  {
    id: "central canonical Delivered transaction writer",
    file: "app/admin/delivery/canonical-delivery-authority.server.ts",
    patterns: [
      /export function writeCanonicalDeliveryCompletionInTransaction\(/,
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
      /reconcileCanonicalDelivery\(reference/,
      /source: "direct_admin_request"/,
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
      /export async function updateDeliveryAttempt\(/,
      /canonical_status_unchanged: input\.status === "delivered"/,
      /if \(input\.status !== "delivered"\) shipmentUpdate\.status = shipmentStatusForDelivery/,
      /await reconcileCanonicalDelivery\(scope\.reference, \{ source: "manual_delivery"/,
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
      /if \(milestone === "delivered"\) return "delivered"/,
      /if \(targetStatus === "delivered"\)/,
      /canonical_delivery_authority_required/,
      /canonical_delivery_authority_satisfied/,
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
      /export async function adoptTrackedDelivery\(/,
      /external_observed_milestone\) !== "delivered"/,
      /status: "delivered" as const/,
      /await reconcileCanonicalDelivery\(scope\.reference, \{ source: "manual_delivery"/,
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
  {
    id: "CRM relink counters derive from current canonical status",
    file: "app/admin/crm/crm-quote-links.server.ts",
    patterns: [
      /const delivered = text\(shipmentSnapshot\.get\("status"\)\) === "delivered";/,
      /active_shipment_count: targetActive \+ \(delivered \? 0 : 1\)/,
      /completed_shipment_count: targetCompleted \+ \(delivered \? 1 : 0\)/,
    ],
    rejects: [/transaction\.update\(shipmentRef, \{[^}]*\bstatus:/],
  },
  {
    id: "TMS booking creates a non-Delivered shipment",
    file: "app/admin/tenders/tms-tendering.server.ts",
    patterns: [
      /transaction\.create\(shipmentRef, \{/,
      /status: "booking_confirmed", eta: null/,
      /active_shipment_count: currentActive \+ 1/,
    ],
    rejects: [/transaction\.create\(shipmentRef, \{[\s\S]{0,3000}?status: "delivered"/],
  },
  {
    id: "Digital Job File metadata update cannot carry canonical status",
    file: "app/admin/job-file.server.ts",
    patterns: [
      /const update: Record<string, unknown> = \{/,
      /await ref\.update\(update\);/,
    ],
    rejects: [/const update: Record<string, unknown> = \{[^}]*\bstatus:/],
  },
  {
    id: "Pickup scheduling writes pickup projection fields only",
    file: "app/admin/pickups/pickup-appointments.server.ts",
    patterns: [
      /batch\.update\(scope\.ref, \{ pickup_appointment_id: id, pickup_status: status/,
    ],
    rejects: [
      /scope\.ref\.update\(\{[^}]*\bstatus:/,
      /batch\.update\(scope\.ref, \{[^}]*\bstatus:/,
    ],
  },
  {
    id: "Freight document generation increments a document counter only",
    file: "app/admin/freight-documents/freight-documents.server.ts",
    patterns: [
      /batch\.update\(scope\.shipmentRef, \{ generated_freight_document_count: FieldValue\.increment\(1\)/,
    ],
    rejects: [/batch\.update\(scope\.shipmentRef, \{[^}]*\bstatus:/],
  },
  {
    id: "Migration recovery recounts completion from canonical status",
    file: "app/admin/migration/recovery/recovery.server.ts",
    patterns: [
      /if \(text\(doc\.get\("status"\)\) === "delivered"\) completed \+= 1;/,
      /collection\("customers"\)\.doc\(customerId\)\.set\(\{ active_shipment_count: active, completed_shipment_count: completed/,
    ],
    rejects: [/collection\("shipments"\)\.doc\([^)]*\)\.update\(\{[^}]*\bstatus:/],
  },
  {
    id: "Customer notification sweep writes only its own delivery and watermark records",
    file: "app/portal/portal-notifications.server.ts",
    patterns: [
      /collection\("portal_email_deliveries"\)/,
      /collection\("portal_notification_state"\)/,
    ],
    rejects: [
      /collection\("shipments"\)\.doc\([^)]*\)\.(?:update|set|create|delete)\(/,
      /status: "delivered"/,
    ],
  },
  {
    id: "EDI X12 module stays a pure parser and serializer",
    file: "app/admin/edi/edi-x12.ts",
    patterns: [
      /export type X12Segment = \{ tag: string; elements: string\[\] \};/,
      /const seCount = body\.length \+ 1;/,
    ],
    rejects: [/\bFirestore\b|firebaseAdminDb|firebase-admin/],
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
    const unexpectedPatterns = (expected.rejects ?? []).filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
    if (!missingPatterns.length && !unexpectedPatterns.length) return [];
    const reasons = [];
    if (missingPatterns.length) reasons.push(`missing signature(s): ${missingPatterns.join(", ")}`);
    if (unexpectedPatterns.length) reasons.push(`forbidden signature(s): ${unexpectedPatterns.join(", ")}`);
    return [{ ...expected, reason: reasons.join("; ") }];
  });

  // Class F is only allowed to mean "no writer". A read-only module that gained a
  // mutation statement must be re-reviewed into A/B/C/E instead of staying read-only.
  const readOnlyViolations = reviewedClassifications
    .filter((review) => review.category === "F")
    .flatMap((review) => {
      let text;
      try {
        text = source(review.file);
      } catch (error) {
        return [{ file: review.file, patterns: [error instanceof Error ? error.message : "file could not be read"] }];
      }
      const hits = readOnlyMutationPatterns.filter((pattern) => pattern.test(text));
      return hits.length ? [{ file: review.file, patterns: hits.map((pattern) => String(pattern)) }] : [];
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
    read_only_violation_count: readOnlyViolations.length,
    read_only_violations: readOnlyViolations,
  };

  console.log("KCPL_CANONICAL_DELIVERY_WRITER_INVENTORY_BEGIN");
  console.log(JSON.stringify(inventory, null, 2));
  console.log("KCPL_CANONICAL_DELIVERY_WRITER_INVENTORY_END");
  console.log(`KCPL_CANONICAL_DELIVERY_GATE Category D=${categoryD.length} unknown=${unknown.length} multiple=${multiple.length} missing expected=${missingExpected.length} read-only violations=${readOnlyViolations.length}`);

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
  assert.equal(
    readOnlyViolations.length,
    0,
    `Read-only (category F) module gained a persistence mutation:\n${readOnlyViolations.map((violation) => `  ${violation.file}\n${violation.patterns.map((pattern) => `    ${pattern}`).join("\n")}`).join("\n")}`,
  );
});
