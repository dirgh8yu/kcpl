import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { POST } from "../app/api/quotes/route.ts";
import { clearQuoteEndpointTestHooks, setQuoteEndpointTestHooks } from "../app/api/quotes/quote-endpoint.ts";

/*
 * Endpoint-level proof for the lane attribution. These tests POST to the real
 * `POST` exported by `app/api/quotes/route.ts` — same guard, validation,
 * challenge, rate limit, CRM lookup and write order the deployed route runs —
 * with the three I/O collaborators replaced through the documented test hook.
 * No Firebase client is constructed and no network call is made.
 */

const ORIGIN = "https://kapileshworcargo.com.np";

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

function install({ matches = [] } = {}) {
  const writes = [];
  const crmInputs = [];
  setQuoteEndpointTestHooks({
    store: {
      async create(reference, record) {
        writes.push({ reference, record });
      },
    },
    crmMatcher: async (input) => {
      crmInputs.push(input);
      return matches;
    },
    rateLimitStore: memoryRateLimitStore(),
  });
  return { writes, crmInputs };
}

function payload(overrides = {}) {
  return {
    origin: "काठमाडौं",
    destination: "ल्हासा",
    mode: "road",
    cargoType: "FTL 8t",
    weight: "6400",
    weightUnit: "kg",
    contactName: "Lane Test",
    contactEmail: "Lane-Test@Example.com",
    companyName: "Example Traders Pvt Ltd",
    phone: "+977-1-0000001",
    website: "",
    attribution: {
      source: "lane",
      lane_path: "/ne/lanes/nepal-to-tibet",
      landing_path: "/ne/quote",
    },
    ...overrides,
  };
}

function post(body, headers = {}) {
  return POST(new Request(`${ORIGIN}/api/quotes`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  }));
}

// The guard reads the environment, which this machine does not configure.
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

afterEach(() => {
  clearQuoteEndpointTestHooks();
});

test("a lane enquiry through the real endpoint persists the canonical corridor", async () => {
  const { writes, crmInputs } = install();

  const response = await post(payload());
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.match(body.reference, /^KCPL-Q-\d{8}-[0-9A-F]{8}$/);

  assert.equal(writes.length, 1);
  const { record, reference } = writes[0];
  assert.equal(reference, body.reference);
  assert.equal(record.reference, body.reference);

  // The words the visitor typed are stored as typed …
  assert.equal(record.origin, "काठमाडौं");
  assert.equal(record.destination, "ल्हासा");
  // … and the English corridor is stored beside them.
  assert.equal(record.lane_slug, "nepal-to-tibet");
  assert.equal(record.lane_origin, "Kathmandu");
  assert.equal(record.lane_destination, "Lhasa");
  // The lane path itself still travels through the endpoint.
  assert.equal(record.attribution.lane_path, "/ne/lanes/nepal-to-tibet");
  assert.equal(record.attribution.source, "lane");
  assert.equal(record.status, "new");

  // Dedupe ran with the same inputs as before, and found nothing.
  assert.deepEqual(crmInputs, [{
    displayName: "Example Traders Pvt Ltd",
    primaryEmail: "lane-test@example.com",
    primaryPhone: "+977-1-0000001",
    taxId: "",
  }]);
  assert.equal(record.crm_match_state, "unmatched");
  assert.deepEqual(record.crm_match_ids, []);
});

test("a no-lane enquiry still succeeds and stores null corridor fields", async () => {
  const { writes } = install();

  const response = await post(payload({
    origin: "Kolkata",
    destination: "Birgunj",
    mode: "sea",
    attribution: { source: "direct", landing_path: "/quote" },
  }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).ok, true);

  assert.equal(writes.length, 1);
  const { record } = writes[0];
  assert.equal(record.origin, "Kolkata");
  assert.equal(record.destination, "Birgunj");
  assert.equal(record.lane_slug, null);
  assert.equal(record.lane_origin, null);
  assert.equal(record.lane_destination, null);
  assert.equal(record.attribution.lane_path, null);
  assert.equal(record.crm_match_state, "unmatched");
  assert.deepEqual(record.crm_match_ids, []);
});

test("CRM matches are written exactly as before, for a lane and a non-lane enquiry", async () => {
  const matches = [{ id: "crm-1", display_name: "Example Traders Pvt Ltd", reason: "name" }];
  const { writes, crmInputs } = install({ matches });

  assert.equal((await post(payload())).status, 201);
  assert.equal((await post(payload({ attribution: { source: "direct", landing_path: "/quote" } }))).status, 201);

  assert.equal(writes.length, 2);
  assert.equal(crmInputs.length, 2, "dedupe runs before the write, on both paths");
  for (const record of writes.map((entry) => entry.record)) {
    assert.equal(record.crm_match_state, "suggested");
    assert.deepEqual(record.crm_match_ids, ["crm-1"]);
    assert.deepEqual(record.crm_matches, matches);
    assert.equal(record.crm_linked_at, null);
    assert.equal(record.crm_linked_by_name, null);
    assert.equal(record.crm_linked_by_email, null);
  }
  // The lane fields are the only difference between the two stored documents.
  const [laneRecord, directRecord] = writes.map((entry) => entry.record);
  assert.deepEqual(Object.keys(laneRecord).sort(), Object.keys(directRecord).sort());
});

test("the lane index records the page but names no corridor", async () => {
  const { writes } = install();
  const response = await post(payload({
    attribution: { source: "lane", lane_path: "/zh/lanes", landing_path: "/zh/quote" },
  }));
  assert.equal(response.status, 201);
  const { record } = writes[0];
  assert.equal(record.attribution.lane_path, "/zh/lanes");
  assert.equal(record.lane_slug, null);
  assert.equal(record.lane_origin, null);
});

test("with no injected store and no Firebase config the endpoint still answers 503", async () => {
  clearQuoteEndpointTestHooks();
  assert.equal(process.env.FIREBASE_PROJECT_ID, undefined);
  assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, undefined);

  const response = await post(payload());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "Quote storage is not configured yet. Please email KCPL instead.");
});

test("an injected store does not bypass validation", async () => {
  const { writes, crmInputs } = install();
  const response = await post(payload({ origin: "", contactEmail: "not-an-email" }));
  assert.equal(response.status, 400);
  assert.equal(writes.length, 0);
  assert.equal(crmInputs.length, 0);
});
