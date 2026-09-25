import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isApplePrivateRelay, portalDenialMessage } from "../app/portal/portal-access-policy.ts";
import { portalSignInProviders } from "../app/portal/portal-sign-in-providers.ts";

test("the portal offers only the providers configured, Apple first", () => {
  assert.deepEqual(portalSignInProviders(""), []);
  assert.deepEqual(portalSignInProviders("google"), ["google"]);
  assert.deepEqual(portalSignInProviders(" Google , apple "), ["apple", "google"]);
  assert.deepEqual(portalSignInProviders("facebook,github"), []);
});

test("a hidden Apple address is told how to get in, and nothing else changes", () => {
  assert.equal(isApplePrivateRelay("x7k2@privaterelay.appleid.com"), true);
  assert.equal(isApplePrivateRelay("contact@customer.com"), false);
  assert.match(portalDenialMessage("no_account", "x7k2@privaterelay.appleid.com"), /Share My Email/);
  assert.match(portalDenialMessage("no_account", "contact@customer.com"), /does not have KCPL portal access/);
  // Only a missing account gets the hint: a relay address never widens access.
  assert.match(portalDenialMessage("account_disabled", "x7k2@privaterelay.appleid.com"), /does not have KCPL portal access/);
});

test("a provider sign-in still goes through the same session route and verification", async () => {
  const source = await readFile(new URL("../app/portal/portal-login.tsx", import.meta.url), "utf8");
  // Every path ends in establish(), which posts the ID token to the session
  // route; the server decides access exactly as for a password.
  assert.match(source, /signInWithPopup\(auth, authProvider\);\s*await establish\(credential\.user\)/);
  assert.match(source, /fetch\("\/api\/portal\/session"/);
  // A password account is linked only after its own password sign-in.
  assert.match(source, /signInWithEmailAndPassword[\s\S]*linkWithCredential\(credential\.user, pendingLink\.credential\)/);
  // The client never keeps a Firebase session.
  assert.match(source, /inMemoryPersistence/);
});
