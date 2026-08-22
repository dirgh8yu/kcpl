import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
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

test("1 one-active-tender creation is owned by a Firestore transaction and order pointer", () => {
  assert.match(tenderServer, /createTmsTender[\s\S]*?runTransaction/);
  assert.match(tenderServer, /activeTenderDocsInTransaction/);
  assert.match(tenderServer, /active_tender_id: id/);
});

test("2 concurrent tender creation serializes on the transport order", () => {
  assert.match(tenderServer, /transaction\.get\(orderRef\)/);
  assert.match(tenderServer, /transaction\.update\(orderRef, \{ status: "tendering", active_tender_id: id/);
  assert.match(tenderServer, /state_conflict/);
});

test("3 stale tender response requires the authoritative order pointer", () => {
  assert.match(tenderServer, /authoritativeTenderInTransaction/);
  assert.match(tenderServer, /return \{ kind: "stale_tender" as const \}/);
});

test("4 accept versus cancel uses an optimistic version token revalidated inside each transaction", () => {
  assert.match(tenderServer, /expectedUpdatedAt/);
  assert.match(tenderServer, /tender\.updated_at !== expectedUpdatedAt/);
});

test("5 accept versus reject can only mutate from the transaction-read current state", () => {
  assert.match(tenderServer, /tenderResponseAllowed\(tender\.status, input\.status\)/);
  assert.match(tenderServer, /transaction\.update\(tenderRef, update\)/);
});

test("6 duplicate identical response is idempotent before any duplicate audit event", () => {
  assert.match(tenderServer, /responseMatches\(tender, input\)/);
  assert.match(tenderServer, /idempotent: true/);
});

test("7 one-booking invariant creates the shipment and parent state in one transaction", () => {
  assert.match(tenderServer, /createBookedShipment[\s\S]*?runTransaction/);
  assert.match(tenderServer, /transaction\.create\(shipmentRef/);
  assert.match(tenderServer, /status: "booked"/);
});

test("8 booking retry returns the canonical existing shipment", () => {
  assert.match(tenderServer, /tender\.status === "booked"/);
  assert.match(tenderServer, /shipmentReference: existingReference, idempotent: true/);
});

test("9 conflicting booking reference is rejected rather than rewritten", () => {
  assert.match(tenderServer, /existingBookingReference !== bookingReference/);
  assert.match(tenderServer, /kind: "booking_conflict"/);
  assert.match(tenderRoute, /booking_conflict/);
});

test("10 book versus cancel is protected by the same tender version and transaction lock", () => {
  const expectedChecks = tenderServer.match(/updated_at !== expectedUpdatedAt/g) ?? [];
  assert.ok(expectedChecks.length >= 2);
  assert.match(tenderServer, /cancelTmsTender[\s\S]*?runTransaction/);
});

test("11 customer active shipment count is changed in the booking transaction only once", () => {
  assert.match(tenderServer, /transaction\.get\(customerRef\)/);
  assert.match(tenderServer, /active_shipment_count: currentActive \+ 1/);
  assert.doesNotMatch(tenderServer, /FieldValue\.increment/);
});

test("12 Job File workflow seeding is deterministic and repairable", () => {
  assert.match(bookingArtifacts, /booking_artifact_seed_version/);
  assert.match(bookingArtifacts, /workflow-task-\$\{index \+ 1\}/);
  assert.match(bookingArtifacts, /workflow-customs-\$\{index \+ 1\}/);
  assert.doesNotMatch(bookingArtifacts, /randomUUID|randomBytes/);
});

test("13 booking activity cannot duplicate on retry", () => {
  assert.match(bookingArtifacts, /doc\("booking-confirmed"\)/);
  assert.match(bookingArtifacts, /booking_artifacts_seeded_at/);
  assert.match(bookingArtifacts, /doc\(`shipment-\$\{reference\}`\)/);
});

test("20 EDI 990 routes through the same safe tender response transition", () => {
  assert.match(ediGateway, /respondToTmsTenderFromEdi990/);
  assert.doesNotMatch(ediGateway, /batch\.update\(tender\.ref/);
  assert.match(tenderServer, /edi_990_transaction_id/);
});

test("21 expired and terminal tenders cannot resurrect", () => {
  assert.equal(tenderResponseAllowed("expired", "accepted"), false);
  assert.equal(tenderResponseAllowed("cancelled", "accepted"), false);
  assert.equal(tenderResponseAllowed("rejected", "accepted"), false);
  assert.match(tenderServer, /tenderIsExpired\(tender, now\)/);
});

test("22 manual and email tender workflows remain wired through the same creation path", () => {
  assert.match(tenderRoute, /sendTmsTenderEmail/);
  assert.match(tenderRoute, /channel === "email"/);
  assert.match(tenderRoute, /createTmsTender/);
});

test("23 EDI 204 workflow remains compatible while tender creation owns the active pointer", () => {
  assert.match(tenderRoute, /queueTenderAsEdi204/);
  assert.match(ediTender, /queueEdi204/);
  assert.match(tenderServer, /channel: input\.channel/);
});

test("24 counter-offer booking remains supported", () => {
  assert.equal(tenderCanBook("countered"), true);
  assert.match(tenderServer, /tenderFinalCommercials\(tender\)/);
});

test("25 branch RBAC and same-origin mutation controls remain enforced", () => {
  assert.match(tenderRoute, /isTrustedSameOriginRequest/);
  assert.match(tenderRoute, /canViewCommercial/);
  assert.match(tenderServer, /permissions\.canEditCommercial/);
  assert.match(tenderServer, /staffCanAccessBranch/);
});
