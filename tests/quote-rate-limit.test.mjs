import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  checkQuoteRateLimit,
  clientAddress,
  quoteRateLimitPolicies,
  rateLimitSubjectKey,
} from "../app/api/quotes/quote-rate-limit-policy.ts";

// The public quote form is the one endpoint the internet can write to, so its
// abuse control has to hold under more than a happy path. These tests drive the
// limiter through an in-memory store: window accounting, subject isolation,
// retry-after, and what happens when the store itself fails.

function memoryStore(initial = {}) {
  const records = new Map(Object.entries(initial));
  const writes = [];
  return {
    records,
    writes,
    async read(key) {
      return records.get(key) ?? null;
    },
    async write(key, record) {
      writes.push({ key, record });
      records.set(key, record);
    },
  };
}

const policy = { name: "test", limit: 3, windowMs: 60_000 };
const subject = (value, overrides = {}) => ({ policy: { ...policy, ...overrides }, value });

test("the shipped policies stay loose enough for real enquiries and tight enough to bite", () => {
  const address = quoteRateLimitPolicies.address;
  const contact = quoteRateLimitPolicies.contact;

  for (const policy of [address, contact]) {
    assert.ok(policy.limit >= 1, policy.name + " must allow at least one submission per window");
    assert.ok(policy.windowMs >= 60_000, policy.name + " window is too short to mean anything");
    assert.equal(typeof policy.name, "string");
  }

  // One address can legitimately carry several enquiries (a forwarder, a shared
  // office connection), while one address repeating itself is the scripted case.
  assert.ok(
    address.limit > contact.limit,
    "the address budget must be the looser of the two",
  );
  assert.notEqual(address.name, contact.name, "policies must not share a key space");
});

test("a subject may submit up to its limit and is then refused", async () => {
  const store = memoryStore();
  const now = 1_000_000;

  for (let attempt = 1; attempt <= policy.limit; attempt += 1) {
    const decision = await checkQuoteRateLimit({ subjects: [subject("a@example.com")], store, now, salt: "s" });
    assert.equal(decision.allowed, true, `attempt ${attempt} should be allowed`);
    assert.equal(decision.degraded, false);
  }

  const blocked = await checkQuoteRateLimit({ subjects: [subject("a@example.com")], store, now, salt: "s" });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.blockedBy, "test");
  assert.ok(blocked.retryAfterSeconds > 0, "a refusal has to say when to come back");
  assert.ok(
    blocked.retryAfterSeconds <= Math.ceil(policy.windowMs / 1000),
    "retry-after cannot outlast the window",
  );
});

test("a refusal does not consume the allowance or roll the window", async () => {
  const store = memoryStore();
  const now = 2_000_000;
  for (let attempt = 0; attempt < policy.limit; attempt += 1) {
    await checkQuoteRateLimit({ subjects: [subject("a@example.com")], store, now, salt: "s" });
  }
  const before = [...store.records.values()][0];

  await checkQuoteRateLimit({ subjects: [subject("a@example.com")], store, now: now + 5_000, salt: "s" });

  const after = [...store.records.values()][0];
  assert.deepEqual(after, before, "a refused request must not rewrite the counter");
  assert.equal(store.writes.length, policy.limit, "only allowed requests are written");
});

test("the window resets once it has elapsed", async () => {
  const store = memoryStore();
  const now = 3_000_000;
  for (let attempt = 0; attempt < policy.limit; attempt += 1) {
    await checkQuoteRateLimit({ subjects: [subject("a@example.com")], store, now, salt: "s" });
  }
  assert.equal((await checkQuoteRateLimit({ subjects: [subject("a@example.com")], store, now, salt: "s" })).allowed, false);

  const later = await checkQuoteRateLimit({
    subjects: [subject("a@example.com")],
    store,
    now: now + policy.windowMs,
    salt: "s",
  });
  assert.equal(later.allowed, true, "the counter starts over after a full window");
});

test("different subjects and different policies do not share an allowance", async () => {
  const store = memoryStore();
  const now = 4_000_000;

  // A second address is unaffected by the first address being blocked.
  for (let attempt = 0; attempt < policy.limit; attempt += 1) {
    await checkQuoteRateLimit({ subjects: [subject("192.0.2.10")], store, now, salt: "s" });
  }
  assert.equal((await checkQuoteRateLimit({ subjects: [subject("192.0.2.10")], store, now, salt: "s" })).allowed, false);
  assert.equal((await checkQuoteRateLimit({ subjects: [subject("192.0.2.11")], store, now, salt: "s" })).allowed, true);

  // The same value under a different policy is a separate budget.
  const other = await checkQuoteRateLimit({
    subjects: [subject("a@example.com", { name: "contact" })],
    store,
    now,
    salt: "s",
  });
  assert.equal(other.allowed, true);
});

test("a request must satisfy every subject it is measured against", async () => {
  const store = memoryStore();
  const now = 5_000_000;
  const address = { policy: { name: "address", limit: 5, windowMs: 60_000 }, value: "192.0.2.4" };
  const contact = { policy: { name: "contact", limit: 2, windowMs: 60_000 }, value: "a@example.com" };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal((await checkQuoteRateLimit({ subjects: [address, contact], store, now, salt: "s" })).allowed, true);
  }

  const decision = await checkQuoteRateLimit({ subjects: [address, contact], store, now, salt: "s" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.blockedBy, "contact", "the tighter policy is the one that blocks");
});

test("a subject with no value is skipped rather than pooled into one bucket", async () => {
  const store = memoryStore();
  const skipped = await checkQuoteRateLimit({
    subjects: [{ policy, value: null }],
    store,
    now: 6_000_000,
    salt: "s",
  });
  assert.equal(skipped.allowed, true);
  assert.equal(store.writes.length, 0, "nothing to key on means nothing to record");

  // A missing address must not stop an email from being limited.
  const store2 = memoryStore();
  const res = await checkQuoteRateLimit({
    subjects: [{ policy, value: null }, subject("a@example.com")],
    store: store2,
    now: 6_000_000,
    salt: "s",
  });
  assert.equal(res.allowed, true);
  assert.equal(store2.writes.length, 1);
});

test("an unavailable store fails open and says so", async () => {
  const failing = {
    async read() {
      throw new Error("firestore unavailable");
    },
    async write() {
      throw new Error("firestore unavailable");
    },
  };
  const decision = await checkQuoteRateLimit({
    subjects: [subject("a@example.com")],
    store: failing,
    now: 7_000_000,
    salt: "s",
  });
  // The limiter shares Firestore with the write it guards, so refusing here
  // would break the form during an outage without protecting anything.
  assert.equal(decision.allowed, true);
  assert.equal(decision.degraded, true);
});

test("a write failure does not reject the enquiry", async () => {
  const store = {
    async read() {
      return null;
    },
    async write() {
      throw new Error("firestore unavailable");
    },
  };
  const decision = await checkQuoteRateLimit({
    subjects: [subject("a@example.com")],
    store,
    now: 8_000_000,
    salt: "s",
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.degraded, true);
});

test("stored keys do not contain the subject they identify", () => {
  const email = "someone@example.com";
  const key = rateLimitSubjectKey("contact", email, "salt");
  assert.ok(!key.includes(email));
  assert.ok(!key.includes("example.com"));
  assert.match(key, /^[0-9a-f]{40}$/);

  // Stable for the same inputs, distinct across policy, value and salt, so one
  // budget cannot be spent by another.
  assert.equal(key, rateLimitSubjectKey("contact", email, "salt"));
  assert.notEqual(key, rateLimitSubjectKey("address", email, "salt"));
  assert.notEqual(key, rateLimitSubjectKey("contact", "other@example.com", "salt"));
  assert.notEqual(key, rateLimitSubjectKey("contact", email, "different-salt"));
});

test("the client address comes from the proxy headers and is normalised", () => {
  const withForwarded = new Request("https://kcpl.example/api/quotes", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" },
  });
  assert.equal(clientAddress(withForwarded), "203.0.113.9", "the client is the first hop, not the proxy");

  const mapped = new Request("https://kcpl.example/api/quotes", {
    headers: { "x-forwarded-for": "::ffff:203.0.113.9" },
  });
  assert.equal(clientAddress(mapped), "203.0.113.9", "IPv4-mapped IPv6 is the same client");

  const realOnly = new Request("https://kcpl.example/api/quotes", { headers: { "x-real-ip": "198.51.100.7" } });
  assert.equal(clientAddress(realOnly), "198.51.100.7");

  const none = new Request("https://kcpl.example/api/quotes");
  assert.equal(clientAddress(none), null, "no header means address limiting is skipped, not pooled");
});

test("the quote route measures abuse before it does CRM or Firestore work", () => {
  const route = readFileSync(new URL("../app/api/quotes/route.ts", import.meta.url), "utf8");
  const policy = readFileSync(
    new URL("../app/api/quotes/quote-rate-limit-policy.ts", import.meta.url),
    "utf8",
  );
  const store = readFileSync(
    new URL("../app/api/quotes/quote-rate-limit.server.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /checkQuoteRateLimit/, "the route must use the limiter");
  assert.match(route, /429/, "an over-limit submission is refused, not accepted");
  assert.match(route, /retry-after/, "a refusal tells the caller when to retry");
  assert.match(route, /clientAddress/, "address limiting has to be wired to the request");
  assert.match(route, /quoteRateLimitPolicies\.contact/, "email limiting has to be wired too");

  const limitIndex = route.indexOf("checkQuoteRateLimit({");
  const crmIndex = route.indexOf("findCrmDuplicates(");
  const writeIndex = route.indexOf('.doc(reference).create(');
  assert.ok(limitIndex > 0 && crmIndex > limitIndex, "the limit must run before CRM matching");
  assert.ok(writeIndex > limitIndex, "the limit must run before the Firestore write");

  // The honeypot and validation stay, as secondary controls.
  assert.match(route, /payload\.website/);
  assert.match(route, /function validate/);

  assert.match(store, /firebaseAdminDb\(\)/, "the counter has to be durable, not in-process");
  assert.match(store, /expires_at/, "counters carry a TTL field so they expire on their own");
  assert.match(policy, /createHash/, "subjects are stored hashed, not in the clear");
  assert.match(policy, /KCPL_RATE_LIMIT_SALT/, "the hash can be salted per deployment");
  assert.doesNotMatch(policy, /from "\.[^"]*"/, "the policy module must stay importable without project aliases");
});
