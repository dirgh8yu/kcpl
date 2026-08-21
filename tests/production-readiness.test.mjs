import assert from "node:assert/strict";
import test from "node:test";

import { productionRuntimeReadiness } from "../app/production-readiness.ts";

function completeEnv() {
  return {
    NODE_ENV: "production",
    FIREBASE_CONFIG: JSON.stringify({
      projectId: "kcpl-production",
      storageBucket: "kcpl-production.firebasestorage.app",
    }),
    NEXT_PUBLIC_SITE_URL: "https://kcpl.example.com",
    KCPL_ADMIN_EMAILS: "owner@example.com",
    KCPL_MANAGEMENT_EMAILS: "owner@example.com",
    KCPL_AUTOMATION_SECRET: "0123456789abcdef0123456789abcdef",
    GOOGLE_MAPS_PLACES_API_KEY: "places-secret-value",
    GOOGLE_MAPS_ROUTES_API_KEY: "routes-secret-value",
    SENDGRID_API_KEY: "sendgrid-secret-value",
    KCPL_EMAIL_FROM: "operations@example.com",
  };
}

test("a complete production runtime reports ready", () => {
  const result = productionRuntimeReadiness(completeEnv());
  assert.equal(result.overall, "ready");
  assert.equal(result.summary.blocked, 0);
  assert.equal(result.summary.warnings, 0);
});

test("core Firebase, Storage, canonical-origin and automation gaps block readiness", () => {
  const result = productionRuntimeReadiness({ NODE_ENV: "production" });
  assert.equal(result.overall, "blocked");

  const blocked = new Set(result.checks.filter((item) => item.status === "blocked").map((item) => item.id));
  assert.equal(blocked.has("firebase-runtime"), true);
  assert.equal(blocked.has("firebase-storage"), true);
  assert.equal(blocked.has("site-origin"), true);
  assert.equal(blocked.has("automation-secret"), true);
});

test("optional integrations warn without hiding a healthy core runtime", () => {
  const env = completeEnv();
  delete env.GOOGLE_MAPS_PLACES_API_KEY;
  delete env.GOOGLE_MAPS_ROUTES_API_KEY;
  delete env.SENDGRID_API_KEY;
  delete env.KCPL_EMAIL_FROM;
  const result = productionRuntimeReadiness(env);

  assert.equal(result.overall, "warning");
  assert.equal(result.summary.blocked, 0);
  const warnings = new Set(result.checks.filter((item) => item.status === "warning").map((item) => item.id));
  assert.equal(warnings.has("google-places"), true);
  assert.equal(warnings.has("google-routes"), true);
  assert.equal(warnings.has("transactional-email"), true);
});

test("short scheduler secrets and invalid production origins remain blocked", () => {
  const env = completeEnv();
  env.KCPL_AUTOMATION_SECRET = "too-short";
  env.NEXT_PUBLIC_SITE_URL = "http://kcpl.example.com/admin";
  const result = productionRuntimeReadiness(env);

  const blocked = new Set(result.checks.filter((item) => item.status === "blocked").map((item) => item.id));
  assert.equal(blocked.has("automation-secret"), true);
  assert.equal(blocked.has("site-origin"), true);
});

test("readiness output never exposes configured secret values", () => {
  const env = completeEnv();
  const serialized = JSON.stringify(productionRuntimeReadiness(env));
  assert.equal(serialized.includes(env.KCPL_AUTOMATION_SECRET), false);
  assert.equal(serialized.includes(env.GOOGLE_MAPS_PLACES_API_KEY), false);
  assert.equal(serialized.includes(env.GOOGLE_MAPS_ROUTES_API_KEY), false);
  assert.equal(serialized.includes(env.SENDGRID_API_KEY), false);
});
