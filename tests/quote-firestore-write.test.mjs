import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { firestoreQuoteStore } from "../app/api/quotes/quote-firestore-store.ts";
import { buildQuoteRecord } from "../app/api/quotes/quote-record.ts";
import { trackerRow } from "../app/api/quotes/quote-tracker.ts";
import { clearQuoteEndpointTestHooks, setQuoteEndpointTestHooks } from "../app/api/quotes/quote-endpoint.ts";
import { POST } from "../app/api/quotes/route.ts";

/*
 * The enquiry write, short of a Firestore server.
 *
 * The parked question was whether a submitted enquiry reaches `quotes/{reference}`
 * intact. The Firestore emulator cannot run on this machine (no JRE, no Docker),
 * so this file exercises everything up to the SDK boundary a mistake would live
 * in: the adapter's collection and doc id, `create()` rather than `set()` (a
 * duplicate reference must fail, not overwrite), the exact record the endpoint
 * hands the adapter, the absence of `undefined` values Firestore refuses, and the
 * way the stored document reads back through the tracker.
 *
 * What this does not prove: that the live Firestore accepts the write. That needs
 * a configured project or an emulator, and stays parked with that reason.
 */

const ORIGIN = "https://kapileshworcargo.com.np";

/** A recording double for the two Firestore calls the adapter makes. */
function fakeFirestore({ failWith = null } = {}) {
  const calls = [];
  return {
    calls,
    collection(name) {
      return {
        doc(id) {
          return {
            async create(record) {
              if (failWith) throw failWith;
              calls.push({ collection: name, id, record });
              return { writeTime: new Date() };
            },
          };
        },
      };
    },
  };
}

function memoryRateLimitStore() {
  const records = new Map();
  return {
    async read(key) {
      return records.get(key) ?? null;
    },
    async write(key, record) {
      records.set(key, record);
    },
  };
}

/** The endpoint, wired to the real adapter over a recording Firestore. */
function install(db) {
  setQuoteEndpointTestHooks({
    store: firestoreQuoteStore(db),
    crmMatcher: async () => [],
    rateLimitStore: memoryRateLimitStore(),
  });
  return db;
}

function payload(overrides = {}) {
  return {
    origin: "काठमाडौं",
    destination: "ल्हासा",
    mode: "road",
    cargoType: "FTL 8t",
    weight: "6400",
    weightUnit: "kg",
    contactName: "Write Test",
    contactEmail: "Write-Test@Example.com",
    companyName: "Example Traders Pvt Ltd",
    phone: "+977-1-0000002",
    website: "",
    attribution: { source: "lane", lane_path: "/ne/lanes/nepal-to-tibet", landing_path: "/ne/quote" },
    ...overrides,
  };
}

function post(body) {
  return POST(new Request(`${ORIGIN}/api/quotes`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  }));
}

// The endpoint's storage guard reads the environment; this machine configures none.
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

afterEach(() => {
  clearQuoteEndpointTestHooks();
});

function assertNoUndefined(value, path = "record") {
  if (value === undefined) assert.fail(`${path} is undefined, which Firestore rejects`);
  if (value === null || typeof value !== "object") return;
  if (value instanceof Date) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoUndefined(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) assertNoUndefined(entry, `${path}.${key}`);
}

test("the adapter writes quotes/{reference} and not another collection", async () => {
  const db = fakeFirestore();
  await firestoreQuoteStore(db).create("KCPL-Q-20261127-ABCDEF12", { reference: "KCPL-Q-20261127-ABCDEF12" });

  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].collection, "quotes");
  assert.equal(db.calls[0].id, "KCPL-Q-20261127-ABCDEF12");
  assert.equal(db.calls[0].record.reference, "KCPL-Q-20261127-ABCDEF12");
});

test("a reference collision fails instead of overwriting the stored enquiry", async () => {
  const collision = Object.assign(new Error("6 ALREADY_EXISTS: document already exists"), { code: 6 });
  const db = fakeFirestore({ failWith: collision });

  await assert.rejects(() => firestoreQuoteStore(db).create("KCPL-Q-20261127-ABCDEF12", { reference: "KCPL-Q-20261127-ABCDEF12" }), /ALREADY_EXISTS/);
  assert.deepEqual(db.calls, [], "nothing was written over the existing document");
});

test("the endpoint stores exactly the record buildQuoteRecord produces", async () => {
  const db = install(fakeFirestore());
  const response = await post(payload());
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);

  assert.equal(db.calls.length, 1, "one enquiry, one write");
  const { id, record } = db.calls[0];
  assert.equal(id, body.reference);
  assert.equal(record.reference, body.reference);

  // Same document shape, key for key: no field invented by the adapter, none lost.
  const expectedKeys = Object.keys(buildQuoteRecord({
    reference: "KCPL-Q-20261127-ABCDEF12",
    createdAt: "2026-11-27T00:00:00.000Z",
    quote: {
      origin: "काठमाडौं",
      destination: "ल्हासा",
      mode: "road",
      cargoType: "FTL 8t",
      weight: "6400",
      weightUnit: "kg",
      length: "",
      width: "",
      height: "",
      dimensionUnit: "cm",
      timing: "",
      requirements: "",
      contactName: "Write Test",
      contactEmail: "write-test@example.com",
      companyName: "Example Traders Pvt Ltd",
      phone: "+977-1-0000002",
    },
    attribution: { source: "lane", medium: null, campaign: null, lane_path: "/ne/lanes/nepal-to-tibet", landing_path: "/ne/quote" },
    crmMatches: [],
  })).sort();
  assert.deepEqual(Object.keys(record).sort(), expectedKeys);

  // The values a staff reader and the tracker depend on.
  assert.equal(record.status, "new");
  assert.equal(record.contact_email, "write-test@example.com", "stored lowercased");
  assert.equal(record.lane_slug, "nepal-to-tibet");
  assert.equal(record.lane_origin, "Kathmandu");
  assert.equal(record.lane_destination, "Lhasa");
  assert.equal(record.origin, "काठमाडौं", "the visitor's words survive the write");
  assert.equal(record.crm_match_state, "unmatched");
  assert.deepEqual(record.crm_match_ids, []);
  assert.equal(record.attribution.lane_path, "/ne/lanes/nepal-to-tibet");

  // Firestore rejects `undefined` fields; a null is a deliberate absence.
  assertNoUndefined(record);
});

test("an optional field left empty is stored as null, never as an empty string or undefined", async () => {
  const db = install(fakeFirestore());
  assert.equal((await post(payload({ timing: "", requirements: "", companyName: "", phone: "" }))).status, 201);
  const { record } = db.calls[0];
  for (const field of ["timing", "requirements", "company_name", "phone"]) {
    assert.equal(record[field], null, field);
  }
  assert.equal(record.weight_unit, "kg", "a defaulted unit is still stored");
});

test("a failed write answers 500 and never claims the enquiry was received", async () => {
  const db = install(fakeFirestore({ failWith: new Error("etimedout") }));
  const response = await post(payload());

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.reference, undefined, "no reference is handed out for a write that failed");
  assert.equal(body.message, undefined, "no receipt is sent for a write that failed");
  assert.equal(body.error, "KCPL could not save the enquiry. Please try again or email us directly.");
  assert.deepEqual(db.calls, []);
});

test("the stored record reads back into a tracker row with its corridor", async () => {
  const db = install(fakeFirestore());
  await post(payload());
  const row = trackerRow(db.calls[0].record);

  assert.equal(row.reference, db.calls[0].id);
  assert.equal(row.received_at, db.calls[0].record.created_at);
  assert.match(row.received_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(row.source, "lane");
  assert.equal(row.landing_path, "/ne/quote");
  assert.equal(row.company, "Example Traders Pvt Ltd");
  assert.equal(row.contact_email, "write-test@example.com");
  assert.equal(row.origin, "काठमाडौं");
  assert.equal(row.destination, "ल्हासा");
  assert.equal(row.lane_slug, "nepal-to-tibet");
  assert.equal(row.lane_origin, "Kathmandu");
  assert.equal(row.lane_destination, "Lhasa");
  assert.equal(row.status, "new");
  assert.equal(row.weight_kg, "6400", "kilograms are the tracker's weight unit");
});
