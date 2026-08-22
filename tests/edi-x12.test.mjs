import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build204, edi214Milestone, parse214, parse990, parseX12 } from "../app/admin/edi/edi-x12.ts";

test("EDI 204 builder creates a controlled X12 load tender with KCPL references", () => {
  const payload = build204({
    tenderReference: "KCPL-T-20260822-ABCD",
    orderReference: "ORD-20260822-001",
    partnerName: "Example Carrier",
    receiverId: "EXAMPLE",
    origin: "Kathmandu, Nepal",
    destination: "Kolkata, India",
    pickupDate: "2026-08-24",
    deliveryDate: "2026-08-27",
    equipment: "53FT",
    mode: "road",
    weightKg: 1250,
    pieces: 18,
    offeredCost: 85000,
    currency: "NPR",
    controlNumber: 123,
    now: new Date("2026-08-22T10:00:00Z"),
  });
  const envelope = parseX12(payload);
  assert.equal(envelope.transactionSet, "204");
  assert.equal(envelope.interchangeControl, "000000123");
  assert.match(payload, /L11\*ORD-20260822-001\*CN~/);
  assert.match(payload, /L11\*KCPL-T-20260822-ABCD\*TN~/);
  assert.match(payload, /N1\*SF\*Kathmandu, Nepal~/);
  assert.match(payload, /N1\*ST\*Kolkata, India~/);
});

test("EDI 990 accepts N9 and L11 references and maps carrier response", () => {
  const accepted = "ST*990*0001~B1*ABCD*BOOK-44*20260822*A~N9*TN*KCPL-T-20260822-ABCD~L11*ORD-20260822-001*CN~K1*Capacity confirmed~SE*6*0001~";
  const parsed = parse990(accepted);
  assert.equal(parsed.response, "accepted");
  assert.equal(parsed.tenderReference, "KCPL-T-20260822-ABCD");
  assert.equal(parsed.orderReference, "ORD-20260822-001");
  assert.equal(parsed.carrierReference, "BOOK-44");
  assert.equal(parsed.note, "Capacity confirmed");

  const rejected = parse990("ST*990*0002~B1*ABCD*BOOK-45*20260822*D~L11*KCPL-T-20260822-EFGH*TN~SE*3*0002~");
  assert.equal(rejected.response, "rejected");
  assert.equal(rejected.tenderReference, "KCPL-T-20260822-EFGH");
});

test("EDI 214 maps AT7 events into the existing KCPL tracking milestones", () => {
  const payload = "ISA*00*          *00*          *ZZ*CARRIER        *ZZ*KCPL           *260822*1000*U*00401*000000222*0*T*:~GS*QM*CARRIER*KCPL*20260822*1000*1*X*004010~ST*214*0001~B10*BOOK-44*KCPL-S-20260822-ABC123*ABCD~L11*KCPL-T-20260822-ABCD*TN~AT7*AF*NS***20260822*1015*LT~MS1*Kathmandu**NP~AT7*D1*NS***20260824*1410*LT~MS1*Kolkata*WB*IN~SE*8*0001~GE*1*1~IEA*1*000000222~";
  const parsed = parse214(payload);
  assert.equal(parsed.shipmentReference, "KCPL-S-20260822-ABC123");
  assert.equal(parsed.carrierReference, "BOOK-44");
  assert.equal(parsed.tenderReference, "KCPL-T-20260822-ABCD");
  assert.equal(parsed.events.length, 2);
  assert.equal(parsed.events[0].milestone, "picked_up");
  assert.equal(parsed.events[0].location, "Kathmandu, NP");
  assert.equal(parsed.events[1].milestone, "delivered");
  assert.equal(parsed.events[1].location, "Kolkata, WB, IN");
  assert.notEqual(parsed.events[0].providerEventId, parsed.events[1].providerEventId);
});

test("common EDI 214 codes map to operational milestones", () => {
  assert.equal(edi214Milestone("AF"), "picked_up");
  assert.equal(edi214Milestone("X6"), "departed");
  assert.equal(edi214Milestone("OD"), "out_for_delivery");
  assert.equal(edi214Milestone("D1"), "delivered");
  assert.equal(edi214Milestone("SD"), "exception");
});

test("Custom GPT EDI and carrier operation descriptions stay below 300 characters", () => {
  const schema = readFileSync(new URL("../public/kcpl-gpt-action.yaml", import.meta.url), "utf8");
  for (const operationId of ["getKcplEdiBriefing", "getKcplCarrierIntegrationBriefing"]) {
    const index = schema.indexOf(`operationId: ${operationId}`);
    assert.ok(index >= 0, `${operationId} should be present`);
    const section = schema.slice(index, index + 1200);
    const match = section.match(/\n\s+description:\s+([^\n]+)/);
    assert.ok(match, `${operationId} should have a single-line description`);
    assert.ok(match[1].trim().length <= 300, `${operationId} description should be <= 300 characters`);
  }
});
