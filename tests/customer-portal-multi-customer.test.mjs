import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decidePortalAccountLink,
  decidePortalCustomerScope,
  portalAdditionalCustomerIds,
  PORTAL_LINKED_CUSTOMER_LIMIT,
} from "../app/portal/portal-access-policy.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const customer = (id, overrides = {}) => ({
  id,
  display_name: `Customer ${id}`,
  account_status: "active",
  archived: false,
  ...overrides,
});

const primary = { id: "CUST-1", name: "Customer CUST-1" };

/* ------------------------------------------------------------------ *
 * Stored scope
 * ------------------------------------------------------------------ */

test("a stored scope is cleaned of anything that is not a usable id", () => {
  assert.deepEqual(portalAdditionalCustomerIds(["CUST-2", " CUST-3 ", "", null, 7, "CUST-2"]), ["CUST-2", "CUST-3"]);
  // A missing field is no extra scope, never an error and never everything.
  assert.deepEqual(portalAdditionalCustomerIds(undefined), []);
  assert.deepEqual(portalAdditionalCustomerIds("CUST-2"), []);
});

/* ------------------------------------------------------------------ *
 * What a session may read
 * ------------------------------------------------------------------ */

test("an ordinary account sees exactly its own customer", () => {
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: [],
    customers: [customer("CUST-1")],
    requested: null,
  });
  assert.deepEqual(scope.customers, [primary]);
  assert.equal(scope.activeId, "CUST-1");
});

test("a linked customer widens the scope but never replaces the primary", () => {
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: ["CUST-2"],
    customers: [customer("CUST-1"), customer("CUST-2")],
    requested: null,
  });
  assert.deepEqual(scope.customers.map((entry) => entry.id), ["CUST-1", "CUST-2"]);
  // The primary is the customer the session was authorised against, so it is
  // always first and always present.
  assert.equal(scope.customers[0].id, "CUST-1");
  assert.equal(scope.activeId, "CUST-1");
});

test("a requested customer inside the scope becomes the active one", () => {
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: ["CUST-2"],
    customers: [customer("CUST-1"), customer("CUST-2")],
    requested: "CUST-2",
  });
  assert.equal(scope.activeId, "CUST-2");
  assert.equal(scope.activeName, "Customer CUST-2");
});

test("a requested customer outside the scope falls back to the primary", () => {
  for (const requested of ["CUST-9", "", "   ", "../CUST-2", null]) {
    const scope = decidePortalCustomerScope({
      primary,
      additionalCustomerIds: ["CUST-2"],
      customers: [customer("CUST-1"), customer("CUST-2")],
      requested,
    });
    // The cookie is a preference, not a claim: an id nobody granted resolves
    // to the primary customer rather than widening anything.
    assert.equal(scope.activeId, "CUST-1", String(requested));
  }
});

test("a linked customer that does not exist is silently dropped", () => {
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: ["CUST-GONE"],
    customers: [customer("CUST-1")],
    requested: "CUST-GONE",
  });
  assert.deepEqual(scope.customers.map((entry) => entry.id), ["CUST-1"]);
  assert.equal(scope.activeId, "CUST-1");
});

test("an archived or blacklisted principal drops out without locking the agent out", () => {
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: ["CUST-2", "CUST-3", "CUST-4"],
    customers: [
      customer("CUST-1"),
      customer("CUST-2", { archived: true }),
      customer("CUST-3", { account_status: "blacklisted" }),
      customer("CUST-4"),
    ],
    requested: null,
  });
  // KCPL stopping trade with one of an agent's principals must not cost them
  // the others.
  assert.deepEqual(scope.customers.map((entry) => entry.id), ["CUST-1", "CUST-4"]);
});

test("a credit hold still reads, because that is when a balance matters most", () => {
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: ["CUST-2"],
    customers: [customer("CUST-1"), customer("CUST-2", { account_status: "on_hold" })],
    requested: "CUST-2",
  });
  assert.equal(scope.activeId, "CUST-2");
});

test("the primary is never duplicated by a link pointing at it", () => {
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: ["CUST-1", "CUST-2"],
    customers: [customer("CUST-1"), customer("CUST-2")],
    requested: null,
  });
  assert.deepEqual(scope.customers.map((entry) => entry.id), ["CUST-1", "CUST-2"]);
});

test("the linked scope is bounded", () => {
  const ids = Array.from({ length: PORTAL_LINKED_CUSTOMER_LIMIT + 5 }, (_, index) => `CUST-${index + 2}`);
  const scope = decidePortalCustomerScope({
    primary,
    additionalCustomerIds: ids,
    customers: [customer("CUST-1"), ...ids.map((id) => customer(id))],
    requested: null,
  });
  // Each linked record is another customer's data behind one password.
  assert.equal(scope.customers.length, PORTAL_LINKED_CUSTOMER_LIMIT + 1);
});

/* ------------------------------------------------------------------ *
 * Granting and removing a link
 * ------------------------------------------------------------------ */

test("linking a customer adds it once", () => {
  const decision = decidePortalAccountLink({
    action: "link",
    primaryCustomerId: "CUST-1",
    additionalCustomerIds: [],
    targetCustomerId: "CUST-2",
  });
  assert.deepEqual(decision, { kind: "applied", additionalCustomerIds: ["CUST-2"] });
});

test("linking refuses a duplicate, the account's own customer, and nothing at all", () => {
  const base = { action: "link", primaryCustomerId: "CUST-1", additionalCustomerIds: ["CUST-2"] };
  assert.equal(decidePortalAccountLink({ ...base, targetCustomerId: "CUST-2" }).reason, "already_linked");
  assert.equal(decidePortalAccountLink({ ...base, targetCustomerId: "CUST-1" }).reason, "primary_customer");
  assert.equal(decidePortalAccountLink({ ...base, targetCustomerId: "  " }).reason, "invalid_customer");
});

test("linking stops at the limit", () => {
  const full = Array.from({ length: PORTAL_LINKED_CUSTOMER_LIMIT }, (_, index) => `CUST-${index + 2}`);
  const decision = decidePortalAccountLink({
    action: "link",
    primaryCustomerId: "CUST-1",
    additionalCustomerIds: full,
    targetCustomerId: "CUST-999",
  });
  assert.equal(decision.reason, "limit_reached");
});

test("unlinking removes only the named customer", () => {
  const decision = decidePortalAccountLink({
    action: "unlink",
    primaryCustomerId: "CUST-1",
    additionalCustomerIds: ["CUST-2", "CUST-3"],
    targetCustomerId: "CUST-2",
  });
  assert.deepEqual(decision, { kind: "applied", additionalCustomerIds: ["CUST-3"] });
});

test("unlinking something that was never linked is refused, not silently accepted", () => {
  const decision = decidePortalAccountLink({
    action: "unlink",
    primaryCustomerId: "CUST-1",
    additionalCustomerIds: ["CUST-2"],
    targetCustomerId: "CUST-7",
  });
  assert.equal(decision.reason, "not_linked");
});

test("every link denial carries staff-facing copy", () => {
  const denials = [
    decidePortalAccountLink({ action: "link", primaryCustomerId: "CUST-1", additionalCustomerIds: [], targetCustomerId: "" }),
    decidePortalAccountLink({ action: "link", primaryCustomerId: "CUST-1", additionalCustomerIds: [], targetCustomerId: "CUST-1" }),
    decidePortalAccountLink({ action: "unlink", primaryCustomerId: "CUST-1", additionalCustomerIds: [], targetCustomerId: "CUST-2" }),
  ];
  for (const denial of denials) {
    assert.equal(denial.kind, "denied");
    assert.ok(denial.message.length > 10, denial.reason);
  }
});

/* ------------------------------------------------------------------ *
 * Wiring: the cookie carries no authority
 * ------------------------------------------------------------------ */

test("authorisation is still decided by the primary customer alone", async () => {
  const source = code(await readFile(repo("app/portal/portal-accounts.server.ts"), "utf8"));
  const resolve = source.slice(source.indexOf("export async function resolvePortalAccount"));
  const decide = resolve.indexOf("decidePortalAccess({");
  const scope = resolve.indexOf("decidePortalCustomerScope({");
  assert.ok(decide > -1 && scope > decide, "the scope may only widen an already-authorised session");
  // The customer handed to the access decision is the account's own.
  assert.match(resolve, /customers\.find\(\(record\) => record\.id === account\?\.customer_id\)/);
});

test("the active customer is re-derived from Firestore on every request", async () => {
  const source = code(await readFile(repo("app/portal/portal-auth.ts"), "utf8"));
  // The cookie is passed in as a request, and the allowed set it is checked
  // against comes from the account record, not from the browser.
  assert.match(source, /PORTAL_CUSTOMER_COOKIE/);
  assert.match(source, /authorizePortalIdentity\(\{[\s\S]{0,200}\}, requestedCustomerId\)/);
  assert.match(source, /resolvePortalAccount\(identity, requestedCustomerId\)/);
});

test("the switch route can move a session between customers but never widen it", async () => {
  const source = code(await readFile(repo("app/api/portal/customer/route.ts"), "utf8"));
  assert.match(source, /access\.session\.customers\.find\(/);
  assert.match(source, /if \(!match\) return json\([^)]*403\)/);
  // The cookie is only ever written from a value that was already in the
  // session's allowed set.
  assert.match(source, /portalCustomerCookie\(match\.id\)/);
  assert.doesNotMatch(source, /portalCustomerCookie\(customerId\)/);
  assert.match(source, /isTrustedSameOriginRequest/);
});

test("signing out clears the chosen customer as well as the session", async () => {
  const source = code(await readFile(repo("app/api/portal/session/route.ts"), "utf8"));
  assert.match(source, /clearPortalCustomerCookie\(\)/);
  assert.match(source, /clearPortalSessionCookie\(\)/);
});

test("linking customers is a Management action with no customer-side route", async () => {
  const staffRoute = code(await readFile(repo("app/api/admin/portal-access/route.ts"), "utf8"));
  assert.match(staffRoute, /setPortalAccountCustomerLink/);
  assert.match(staffRoute, /canManageStaff/);

  // An account owner who could link customers could grant themselves another
  // company's shipments, so no portal route may reach the writer.
  for (const path of ["app/api/portal/team/route.ts", "app/api/mobile/v1/team/route.ts", "app/portal/portal-team.server.ts"]) {
    const teamSource = code(await readFile(repo(path), "utf8"));
    assert.doesNotMatch(teamSource, /setPortalAccountCustomerLink|additional_customer_ids/, path);
  }
  const switchRoute = code(await readFile(repo("app/api/portal/customer/route.ts"), "utf8"));
  assert.doesNotMatch(switchRoute, /setPortalAccountCustomerLink|additional_customer_ids/);
});

test("re-saving an account preserves its linked customers", async () => {
  const source = code(await readFile(repo("app/portal/portal-accounts.server.ts"), "utf8"));
  const save = source.slice(source.indexOf("export async function savePortalAccount"));
  // Correcting a role must not silently revoke an agent's scope.
  assert.match(save, /additional_customer_ids: existing\.exists \? portalAdditionalCustomerIds\(existing\.get\("additional_customer_ids"\)\) : \[\]/);
});
