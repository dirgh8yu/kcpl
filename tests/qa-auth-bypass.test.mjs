import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  QA_AUTH_BYPASS_UID,
  isQaAuthBypassUser,
  qaAuthBypassEnabled,
  qaAuthBypassIdentity,
} from "../app/admin/qa-auth-bypass.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const development = { KCPL_QA_AUTH_BYPASS: "true", NODE_ENV: "development" };

// The bypass exists so a preview can exercise the staff product without Firebase
// credentials. It is only acceptable while it is impossible to switch on in the
// published runtime, so the negative cases are the point of this suite.
test("the QA bypass stays off unless the flag is exactly \"true\"", () => {
  assert.equal(qaAuthBypassEnabled({}), false);
  assert.equal(qaAuthBypassEnabled({ NODE_ENV: "development" }), false);
  for (const value of ["1", "TRUE", "True", "yes", " true", "true ", ""]) {
    assert.equal(
      qaAuthBypassEnabled({ ...development, KCPL_QA_AUTH_BYPASS: value }),
      false,
      `KCPL_QA_AUTH_BYPASS=${JSON.stringify(value)} must not enable the bypass`,
    );
  }
});

test("the QA bypass can never activate in a production runtime", () => {
  assert.equal(qaAuthBypassEnabled({ ...development, NODE_ENV: "production" }), false);
  assert.equal(qaAuthBypassEnabled({ ...development, NODE_ENV: "test" }), false);
  assert.equal(qaAuthBypassEnabled({ ...development, NODE_ENV: undefined }), false);
  // A published Vercel runtime is authoritative over NODE_ENV.
  assert.equal(
    qaAuthBypassEnabled({ KCPL_QA_AUTH_BYPASS: "true", NODE_ENV: "development", VERCEL_ENV: "production" }),
    false,
  );
  assert.equal(qaAuthBypassEnabled({ KCPL_QA_AUTH_BYPASS: "true", VERCEL_ENV: "production" }), false);
});

test("the QA bypass is reachable from a development runtime only", () => {
  assert.equal(qaAuthBypassEnabled(development), true);
  assert.equal(
    qaAuthBypassEnabled({ KCPL_QA_AUTH_BYPASS: "true", NODE_ENV: "development", VERCEL_ENV: "preview" }),
    true,
  );
  assert.equal(
    qaAuthBypassEnabled({ KCPL_QA_AUTH_BYPASS: "true", NODE_ENV: "development", VERCEL_ENV: "development" }),
    true,
  );
});

test("the QA identity is a fixed synthetic principal, not a configurable one", () => {
  assert.equal(QA_AUTH_BYPASS_UID, "kcpl-qa-preview");
  assert.deepEqual(qaAuthBypassIdentity({}), {
    uid: QA_AUTH_BYPASS_UID,
    email: "qa@kcpl.local",
    displayName: "KCPL QA",
  });
  assert.equal(qaAuthBypassIdentity({ KCPL_QA_EMAIL: "  QA@KCPL.LOCAL  " }).email, "qa@kcpl.local");
  assert.equal(qaAuthBypassIdentity({ KCPL_QA_EMAIL: "   " }).email, "qa@kcpl.local");
});

test("only the synthetic principal counts as the bypass user", () => {
  assert.equal(isQaAuthBypassUser({ uid: QA_AUTH_BYPASS_UID }, development), true);
  assert.equal(isQaAuthBypassUser({ uid: QA_AUTH_BYPASS_UID }, { ...development, NODE_ENV: "production" }), false);
  assert.equal(isQaAuthBypassUser({ uid: "another-staff-uid" }, development), false);
});

// The bypass only works because both authorization paths consult it before they
// require Firebase. Reordering either one silently turns preview QA into an
// "unconfigured" gate, so the ordering is pinned here.
test("both authorization paths consult the QA bypass before requiring Firebase", () => {
  const auth = source("app/admin/admin-auth.ts");
  const authBypass = auth.indexOf("const previewAccess = previewQaAccess();");
  const authFirebase = auth.indexOf('if (!firebaseAdminConfigured()) return { kind: "unconfigured" };');
  assert.ok(authBypass >= 0, "getAdminAccess must consult previewQaAccess()");
  assert.ok(authFirebase >= 0, "getAdminAccess must still gate on firebaseAdminConfigured()");
  assert.ok(authBypass < authFirebase, "getAdminAccess must check the QA bypass before Firebase configuration");

  const directory = source("app/admin/staff-directory.server.ts");
  const directoryBypass = directory.indexOf("const qaContext = qaStaffContext(user);");
  const directoryFirebase = directory.indexOf('if (!firebaseRuntimeConfigured()) throw new Error("Staff directory is unavailable")');
  assert.ok(directoryBypass >= 0, "getStaffContext must consult qaStaffContext()");
  assert.ok(directoryFirebase >= 0, "getStaffContext must still require the Firebase runtime");
  assert.ok(directoryBypass < directoryFirebase, "getStaffContext must return the QA context before requiring Firebase");
});
