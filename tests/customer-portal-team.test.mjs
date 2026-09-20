import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decidePortalTeamChange,
  PORTAL_TEAM_MEMBER_LIMIT,
  portalTeamDenialMessages,
  portalTeamDenialReasons,
} from "../app/portal/portal-access-policy.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const owner = {
  action: "invite",
  actorRole: "owner",
  actorEmail: "owner@customer.com",
  targetEmail: "colleague@customer.com",
  customerId: "CUST-1",
  target: null,
  activeMemberCount: 0,
};

const member = (overrides = {}) => ({ email: "colleague@customer.com", customer_id: "CUST-1", role: "member", ...overrides });

test("an account owner can invite a colleague", () => {
  assert.deepEqual(decidePortalTeamChange(owner), { kind: "allowed" });
});

test("a team member cannot manage logins", () => {
  // Otherwise the access level would mean nothing.
  const decision = decidePortalTeamChange({ ...owner, actorRole: "member" });
  assert.equal(decision.reason, "not_owner");
});

test("an owner cannot create or disable another owner", () => {
  // Who holds commercial authority over an account is KCPL's decision, and it
  // stops one compromised owner locking the real one out.
  assert.equal(decidePortalTeamChange({ ...owner, action: "disable", target: member({ role: "owner" }) }).reason, "owner_target");
  assert.equal(decidePortalTeamChange({ ...owner, target: member({ role: "owner" }) }).reason, "owner_target");
});

test("an owner cannot change their own access", () => {
  // Removing the last owner would strand the account.
  assert.equal(decidePortalTeamChange({ ...owner, targetEmail: "owner@customer.com" }).reason, "self");
  assert.equal(decidePortalTeamChange({ ...owner, targetEmail: " Owner@Customer.com " }).reason, "self", "case and padding do not evade it");
});

test("an address provisioned under another customer is refused, never reassigned", () => {
  const decision = decidePortalTeamChange({ ...owner, target: member({ customer_id: "CUST-2" }) });
  assert.equal(decision.reason, "other_customer");
});

test("a malformed address never reaches the write", () => {
  assert.equal(decidePortalTeamChange({ ...owner, targetEmail: "not-an-email" }).reason, "invalid_email");
  assert.equal(decidePortalTeamChange({ ...owner, targetEmail: "" }).reason, "invalid_email");
});

test("enabling or disabling a login that is not on this account is refused", () => {
  assert.equal(decidePortalTeamChange({ ...owner, action: "enable", target: null }).reason, "missing_target");
  assert.equal(decidePortalTeamChange({ ...owner, action: "disable", target: null }).reason, "missing_target");
});

test("the seat limit bounds how many doors an owner can open", () => {
  const atLimit = { ...owner, activeMemberCount: PORTAL_TEAM_MEMBER_LIMIT };
  assert.equal(decidePortalTeamChange(atLimit).reason, "limit_reached");
  assert.equal(decidePortalTeamChange({ ...atLimit, action: "enable", target: member() }).reason, "limit_reached");
  // Disabling always works: you can always close a door, even at the limit.
  assert.deepEqual(decidePortalTeamChange({ ...atLimit, action: "disable", target: member() }), { kind: "allowed" });
  // Re-inviting someone who already has a login does not consume a second seat.
  assert.deepEqual(decidePortalTeamChange({ ...atLimit, target: member() }), { kind: "allowed" });
});

test("every denial reason has customer-facing copy", () => {
  for (const reason of portalTeamDenialReasons) {
    assert.equal(typeof portalTeamDenialMessages[reason], "string", reason);
    assert.ok(portalTeamDenialMessages[reason].length > 10, reason);
  }
});

/* ------------------------------------------------------------------ *
 * Route wiring
 * ------------------------------------------------------------------ */

test("the team route takes the customer from the session, never the request", async () => {
  const source = code(await readFile(repo("app/api/portal/team/route.ts"), "utf8"));
  assert.match(source, /customerId: access\.session\.customerId/);
  assert.match(source, /actorRole: access\.session\.role/);
  assert.match(source, /actorEmail: access\.session\.email/);
  assert.doesNotMatch(source, /body\.customerId|body\.role/, "neither scope nor access level is caller-supplied");
  assert.match(source, /isTrustedSameOriginRequest/);
});

test("an owner can only ever mint a member", async () => {
  const source = code(await readFile(repo("app/portal/portal-accounts.server.ts"), "utf8"));
  const apply = source.slice(source.indexOf("export async function applyPortalTeamChange"));
  assert.match(apply, /role: "member"/);
  assert.doesNotMatch(apply, /role: "owner"/);
});

test("the team listing is scoped by customer at the query", async () => {
  const source = await readFile(repo("app/portal/portal-accounts.server.ts"), "utf8");
  const listing = source.slice(source.indexOf("export async function listPortalTeam"));
  assert.match(listing.slice(0, 900), /where\("customer_id", "==", customerId\.trim\(\)\)/);
});

test("only an account owner is served the team list", async () => {
  const page = await readFile(repo("app/portal/settings/page.tsx"), "utf8");
  assert.match(page, /access\.session\.role === "owner" \? listPortalTeam/);
  const route = await readFile(repo("app/api/portal/team/route.ts"), "utf8");
  assert.match(route, /access\.session\.role !== "owner"/);
});
