import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { portalQaPreviewEnabled, portalQaPreviewSession, isPortalQaPreviewSession, PORTAL_QA_PREVIEW_UID } from "../app/portal/portal-qa-preview.ts";

const both = { KCPL_QA_AUTH_BYPASS: "true", KCPL_QA_PORTAL: "true" };

// This bypass reaches a customer data surface. Everything below exists to keep
// it impossible to reach one in production.

test("a production runtime refuses the preview however the flags are set", () => {
  for (const env of [
    { ...both, NODE_ENV: "production" },
    { ...both, NODE_ENV: "production", VERCEL_ENV: "production" },
    { ...both, VERCEL_ENV: "production" },
    { ...both }, // no runtime marker at all: refuse rather than assume
  ]) {
    assert.equal(portalQaPreviewEnabled(env), false, `enabled for ${JSON.stringify(env)}`);
  }
});

test("the staff preview alone never opens the customer surface", () => {
  // Turning on the admin bypass must not extend to the portal as a side effect.
  assert.equal(portalQaPreviewEnabled({ KCPL_QA_AUTH_BYPASS: "true", NODE_ENV: "development" }), false);
  assert.equal(portalQaPreviewEnabled({ KCPL_QA_PORTAL: "true", NODE_ENV: "development" }), false);
  assert.equal(portalQaPreviewEnabled({ ...both, NODE_ENV: "development" }), true);
});

test("only the exact string true counts", () => {
  for (const value of ["", "false", "TRUE", "1", "yes", " true"]) {
    assert.equal(portalQaPreviewEnabled({ KCPL_QA_AUTH_BYPASS: "true", KCPL_QA_PORTAL: value, NODE_ENV: "development" }), false, value);
  }
});

test("a preview session is scoped to a customer id no real record uses", () => {
  const session = portalQaPreviewSession({ ...both, NODE_ENV: "development" });
  assert.equal(session.uid, PORTAL_QA_PREVIEW_UID);
  assert.match(session.customerId, /QA-PREVIEW/);
  // The readers scope every query by this id, so a preview cannot surface a
  // real customer's shipments, documents or invoices.
  assert.equal(session.customers.length, 1);
  assert.equal(session.customers[0].id, session.customerId);
});

test("the preview identity is not recognised once the flags are off", () => {
  assert.equal(isPortalQaPreviewSession({ uid: PORTAL_QA_PREVIEW_UID }, { NODE_ENV: "production" }), false);
  assert.equal(isPortalQaPreviewSession({ uid: PORTAL_QA_PREVIEW_UID }, { ...both, NODE_ENV: "development" }), true);
  assert.equal(isPortalQaPreviewSession({ uid: "someone-else" }, { ...both, NODE_ENV: "development" }), false);
});

test("the preview is the only bypass in the portal auth path", () => {
  // A second, less careful short-circuit would make every test above moot.
  const source = readFileSync(new URL("../app/portal/portal-auth.ts", import.meta.url), "utf8");
  // Type declarations write `kind: "authorized";`, returns write it with a
  // comma or a closing brace, so this counts the returns only.
  const returned = source.match(/kind: "authorized"\s*[,}]/g) ?? [];
  // Two resolvers (cookie and mobile bearer) each return the preview and their
  // verified session; authorizePortalIdentity is the fifth.
  assert.equal(returned.length, 5, `authorized is returned from ${returned.length} places; expected the preview and the verified session in each of getPortalAccess and getPortalAccessFromBearer, plus authorizePortalIdentity`);
  // Each preview return sits behind the fenced flag, and nothing else is a preview.
  const previews = source.match(/if \(portalQaPreviewEnabled\(\)\) return \{ kind: "authorized", session: portalQaPreviewSession\(\) \};/g) ?? [];
  assert.equal(previews.length, 2);
  assert.equal((source.match(/portalQaPreviewSession\(\)/g) ?? []).length, 2);
});
