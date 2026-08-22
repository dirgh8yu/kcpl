import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bookingRetryDecision,
  repeatedRejectedTenderDecision,
  resolveTenderAuthority,
  tenderCanBook,
  tenderCanCancel,
  tenderFinalCommercials,
  tenderIsActive,
  tenderIsExpired,
  tenderIsTerminal,
  tenderResponseAllowed,
} from "../app/admin/tenders/tms-tendering.ts";

const tenderServer = readFileSync(new URL("../app/admin/tenders/tms-tendering.server.ts", import.meta.url), "utf8");
const bookingArtifacts = readFileSync(new URL("../app/admin/tenders/tms-booking-artifacts.server.ts", import.meta.url), "utf8");
const tenderRoute = readFileSync(new URL("../app/api/admin/tenders/route.ts", import.meta.url), "utf8");
const ediGateway = readFileSync(new URL("../app/admin/edi/edi-gateway.server.ts", import.meta.url), "utf8");
const ediTender = readFileSync(new URL("../app/admin/edi/edi-tender.server.ts", import.meta.url), "utf8");
const expiryServer = readFileSync(new URL("../app/admin/tenders/tms-tender-expiry.server.ts", import.meta.url), "utf8");

const baseTender = {
  status: "sent",
  response_due_at: "2026-08-22T12:00:00.000Z",
  currency: "USD",
  offered_cost: 1200,
  counter_cost: null,
  counter_currency: null,
};

test("sent tenders accept only a first carrier response", () => {
  assert.equal(tenderResponseAllowed("sent", "accepted"), true);
  assert.equal(tenderResponseAllowed("sent", "rejected"), true);
  assert.equal(tenderResponseAllowed("sent", "countered"), true);
  assert.equal(tenderResponseAllowed("accepted", "rejected"), false);
  assert.equal(tenderResponseAllowed("countered", "accepted"), false);
});

test("only accepted or countered tenders can be booked", () => {
  assert.equal(tenderCanBook("accepted"), true);
  assert.equal(tenderCanBook("countered"), true);
  assert.equal(tenderCanBook("sent"), false);
  assert.equal(tenderCanBook("rejected"), false);
  assert.equal(tenderCanBook("booked"), false);
});

test("counter-offer commercials become the booking snapshot", () => {
  assert.deepEqual(tenderFinalCommercials({ ...baseTender, status: "accepted" }), { amount: 1200, currency: "USD" });
  assert.deepEqual(tenderFinalCommercials({ ...baseTender, status: "countered", counter_cost: 1325, counter_currency: "USD" }), { amount: 1325, currency: "USD" });
  assert.equal(tenderFinalCommercials({ ...baseTender, status: "countered" }), null);
  assert.equal(tenderFinalCommercials({ ...baseTender, status: "sent" }), null);
});

test("only live sent tenders expire by deadline", () => {
  assert.equal(tenderIsExpired(baseTender, "2026-08-22T11:59:59.000Z"), false);
  assert.equal(tenderIsExpired(baseTender, "2026-08-22T12:00:00.000Z"), true);
  assert.equal(tenderIsExpired({ ...baseTender, status: "accepted" }, "2026-08-22T13:00:00.000Z"), false);
});

test("active and terminal state definitions prevent duplicate procurement", () => {
  for (const status of ["sent", "accepted", "countered"]) assert.equal(tenderIsActive(status), true);
  for (const status of ["rejected", "expired", "cancelled", "booked"]) assert.equal(tenderIsTerminal(status), true);
  assert.equal(tenderCanCancel("sent"), true);
  assert.equal(tenderCanCancel("accepted"), true);
  assert.equal(tenderCanCancel("countered"), true);
  assert.equal(tenderCanCancel("booked"), false);
});

test("authority resolution repairs only a unique provable live tender", () => {
  assert.equal(resolveTenderAuthority("T-A", ["T-A"], "T-A"), "authoritative");
  assert.equal(resolveTenderAuthority(null, ["T-B"], "T-B"), "legacy_unique");
  assert.equal(resolveTenderAuthority("T-OLD", ["T-B"], "T-B"), "legacy_unique");
  assert.equal(resolveTenderAuthority("T-A", [], "T-A"), "missing");
  assert.equal(resolveTenderAuthority(null, ["T-A", "T-B"], "T-A"), "ambiguous");
  assert.equal(resolveTenderAuthority("T-B", ["T-B"], "T-A"), "stale");
});

test("old tender cannot become authoritative after re-tender", () => {
  assert.equal(resolveTenderAuthority("T-B", ["T-B"], "T-A"), "stale");
  assert.equal(resolveTenderAuthority("T-B", ["T-B"], "T-B"), "authoritative");
});

test("late duplicate rejection cannot clear a newer active tender", () => {
  assert.equal(repeatedRejectedTenderDecision({ orderStatus: "tendering", activeTenderId: "T-B", rejectedTenderId: "T-A", liveTenderIds: ["T-B"] }), "stale");
  assert.equal(repeatedRejectedTenderDecision({ orderStatus: "selected", activeTenderId: null, rejectedTenderId: "T-A", liveTenderIds: [] }), "idempotent");
  assert.equal(repeatedRejectedTenderDecision({ orderStatus: "tendering", activeTenderId: "T-A", rejectedTenderId: "T-A", liveTenderIds: [] }), "repair_clear");
  assert.equal(repeatedRejectedTenderDecision({ orderStatus: "booked", activeTenderId: "T-A", rejectedTenderId: "T-A", liveTenderIds: [] }), "state_conflict");
});

test("response races permit only the sent-state winner", () => {
  for (const next of ["accepted", "rejected", "countered"]) assert.equal(tenderResponseAllowed("sent", next), true);
  for (const winner of ["accepted", "rejected", "countered", "cancelled", "expired", "booked"]) {
    for (const loser of ["accepted", "rejected", "countered"]) {
      if (winner === loser) continue;
      assert.equal(tenderResponseAllowed(winner, loser), false, `${winner} must reject later ${loser}`);
    }
  }
});

test("booking retry accepts only the same fully consistent canonical shipment", () => {
  const base = {
    requestedBookingReference: "ABC123",
    tenderBookingReference: "ABC123",
    orderBookingReference: "ABC123",
    tenderShipmentReference: "KCPL-S-1",
    orderShipmentReference: "KCPL-S-1",
    shipmentExists: true,
    shipmentOrderId: "ORD-1",
    expectedOrderId: "ORD-1",
    shipmentTenderId: "TND-1",
    expectedTenderId: "TND-1",
    shipmentBookingReference: "ABC123",
    shipmentBranch: "Kathmandu",
    expectedBranch: "Kathmandu",
    shipmentCustomerId: "CUST-1",
    expectedCustomerId: "CUST-1",
    shipmentConsolidationLoadId: null,
  };
  assert.equal(bookingRetryDecision(base), "idempotent");
  assert.equal(bookingRetryDecision({ ...base, requestedBookingReference: "XYZ999" }), "booking_conflict");
  assert.equal(bookingRetryDecision({ ...base, shipmentExists: false }), "state_conflict");
  assert.equal(bookingRetryDecision({ ...base, shipmentTenderId: "TND-OTHER" }), "state_conflict");
  assert.equal(bookingRetryDecision({ ...base, shipmentBranch: "Birgunj" }), "state_conflict");
  assert.equal(bookingRetryDecision({ ...base, shipmentCustomerId: "CUST-OTHER" }), "state_conflict");
  assert.equal(bookingRetryDecision({ ...base, shipmentConsolidationLoadId: "LOAD-1" }), "state_conflict");
});

test("same final counter status with different economics is not semantically idempotent", () => {
  assert.deepEqual(tenderFinalCommercials({ ...baseTender, status: "countered", counter_cost: 1300, counter_currency: "USD" }), { amount: 1300, currency: "USD" });
  assert.notDeepEqual(
    tenderFinalCommercials({ ...baseTender, status: "countered", counter_cost: 1300, counter_currency: "USD" }),
    tenderFinalCommercials({ ...baseTender, status: "countered", counter_cost: 1400, counter_currency: "USD" }),
  );
  assert.equal(tenderResponseAllowed("countered", "countered"), true);
  assert.match(tenderServer, /responseMatches\(tender, input\)/);
  assert.match(tenderServer, /tender\.status !== "sent"/);
});

test("one-active-tender creation is owned by a Firestore transaction and order pointer", () => {
  assert.match(tenderServer, /createTmsTender[\s\S]*?runTransaction/);
  assert.match(tenderServer, /transaction\.get\(orderRef\)/);
  assert.match(tenderServer, /activeTenderDocsInTransaction/);
  assert.match(tenderServer, /active_tender_id: id/);
});

test("legacy pointer repair requires tender and order branch agreement", () => {
  assert.match(tenderServer, /branchValue\(live\.get\("branch"\)\) !== branch/);
  const orderBranchChecks = tenderServer.match(/branchValue\(order\.get\("branch"\)\) !== branch/g) ?? [];
  assert.ok(orderBranchChecks.length >= 3);
});

test("tender response and cancellation revalidate state inside transactions", () => {
  assert.match(tenderServer, /expectedStatus/);
  assert.match(tenderServer, /expectedUpdatedAt/);
  assert.match(tenderServer, /tender\.status !== expectedStatus/);
  assert.match(tenderServer, /cancelTmsTender[\s\S]*?runTransaction/);
});

test("late rejected retry uses behavioural stale-tender guard", () => {
  assert.match(tenderServer, /repeatedRejectedTenderDecision/);
  assert.match(tenderServer, /liveTenderIds: activeState\.live\.map/);
});

test("one-booking invariant creates shipment, parent state and customer counter in one transaction", () => {
  assert.match(tenderServer, /createBookedShipment[\s\S]*?runTransaction/);
  assert.match(tenderServer, /transaction\.create\(shipmentRef/);
  assert.match(tenderServer, /active_shipment_count: currentActive \+ 1/);
  assert.match(tenderServer, /booking_operation_id: `tender:\$\{tender\.id\}`/);
});

test("booked retry validates shipment identity and deterministic quote bridge", () => {
  assert.match(tenderServer, /bookingRetryDecision/);
  assert.match(tenderServer, /transaction\.get\(existingShipmentRef\)/);
  assert.match(tenderServer, /transaction\.get\(quoteRef\)/);
  assert.match(tenderRoute, /booking_conflict/);
});

test("Job File workflow seeding is deterministic, shipment-scoped and repairable", () => {
  assert.match(bookingArtifacts, /booking_artifact_seed_version/);
  assert.match(bookingArtifacts, /shipmentRef\.collection\("job_tasks"\)\.doc\(`workflow-task-\$\{index \+ 1\}`\)/);
  assert.match(bookingArtifacts, /shipmentRef\.collection\("customs_steps"\)\.doc\(`workflow-customs-\$\{index \+ 1\}`\)/);
  assert.match(bookingArtifacts, /shipmentRef\.collection\("events"\)\.doc\("booking-confirmed"\)/);
  assert.match(bookingArtifacts, /shipmentRef\.collection\("job_activity"\)\.doc\("booking-confirmed"\)/);
  assert.match(bookingArtifacts, /customerRef\.collection\("activity"\)\.doc\(`shipment-\$\{reference\}`\)/);
  assert.doesNotMatch(bookingArtifacts, /randomUUID|randomBytes/);
});

test("seed completion marker is part of the same atomic batch as all artifacts", () => {
  assert.match(bookingArtifacts, /const batch = db\.batch\(\)/);
  assert.match(bookingArtifacts, /batch\.update\(shipmentRef, \{ booking_artifacts_seeded_at/);
  assert.match(bookingArtifacts, /await batch\.commit\(\)/);
});

test("EDI 990 routes through the shared safe transition with no direct tender batch mutation", () => {
  assert.match(ediGateway, /respondToTmsTenderFromEdi990/);
  assert.doesNotMatch(ediGateway, /batch\.update\(tender\.ref/);
  assert.match(tenderServer, /edi_990_transaction_id/);
});

test("expired and terminal tenders cannot resurrect", () => {
  assert.equal(tenderResponseAllowed("expired", "accepted"), false);
  assert.equal(tenderResponseAllowed("cancelled", "accepted"), false);
  assert.equal(tenderResponseAllowed("rejected", "accepted"), false);
  assert.match(expiryServer, /freshTender\.get\("status"\) !== "sent"/);
  assert.match(expiryServer, /active_tender_id/);
});

test("manual, email and EDI 204 tender workflows remain compatible", () => {
  assert.match(tenderRoute, /sendTmsTenderEmail/);
  assert.match(tenderRoute, /channel === "email"/);
  assert.match(tenderRoute, /createTmsTender/);
  assert.match(tenderRoute, /queueTenderAsEdi204/);
  assert.match(ediTender, /queueEdi204/);
});

test("counter-offer booking remains supported from transaction-read commercials", () => {
  assert.equal(tenderCanBook("countered"), true);
  assert.match(tenderServer, /tenderFinalCommercials\(tender\)/);
});

test("branch RBAC and same-origin mutation controls remain enforced", () => {
  assert.match(tenderRoute, /isTrustedSameOriginRequest/);
  assert.match(tenderRoute, /canViewCommercial/);
  assert.match(tenderServer, /permissions\.canEditCommercial/);
  assert.match(tenderServer, /staffCanAccessBranch/);
});
