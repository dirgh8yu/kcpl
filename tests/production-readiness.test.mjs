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
    // Machine callers. Each fails closed, so an unset secret is a 503 endpoint
    // rather than an open one, and the probe is what makes that visible.
    KCPL_EDI_SECRET: "edi-secret-value",
    KCPL_TRACKING_INGEST_SECRET: "tracking-secret-value",
    KCPL_PICKUP_INTEGRATION_SECRET: "pickup-secret-value",
    KCPL_GPT_ACTION_SECRET: "gpt-action-secret-value",
    // Portal web push needs all three or the transport is skipped entirely.
    KCPL_VAPID_PUBLIC_KEY: "vapid-public-value",
    KCPL_VAPID_PRIVATE_KEY: "vapid-private-value",
    KCPL_VAPID_SUBJECT: "mailto:operations@example.com",
    MAERSK_CONSUMER_KEY: "consumer-key-value",
    MAERSK_WEBHOOK_SECRET: "maersk-webhook-value",
    DHL_EXPRESS_API_USER: "dhl-user-value",
    DHL_EXPRESS_API_PASSWORD: "dhl-password-value",
    SEARATES_FREIGHT_INDEX_API_KEY: "searates-key-value",
    KCPL_RATE_LIMIT_SALT: "rate-limit-salt-value",
    CLOUDFLARE_TURNSTILE_SECRET_KEY: "turnstile-secret-value",
    NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY: "turnstile-site-key-value",
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

// The probe is what tells KCPL what is missing on the deployed host, so a
// capability it cannot see is a capability nobody checks before launch.

test("the probe covers every variable the application reads", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const root = new URL("../", import.meta.url).pathname;
  const read = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!entry.name.startsWith(".")) walk(rel); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const src = readFileSync(path.join(root, rel), "utf8");
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z_0-9]{3,})/g)) read.add(m[1]);
      for (const m of src.matchAll(/env\[["']([A-Z][A-Z_0-9]{3,})["']\]/g)) read.add(m[1]);
      for (const m of src.matchAll(/text\(env,\s*["']([A-Z][A-Z_0-9]{3,})["']/g)) read.add(m[1]);
    }
  };
  walk("app");

  // Injected by the platform, or read only to branch on the runtime itself.
  const platform = new Set(["FIREBASE_CONFIG", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "K_SERVICE", "K_REVISION", "PORT", "NODE_ENV", "VERCEL_ENV", "NEXT_RUNTIME", "FIREBASE_WEBAPP_CONFIG"]);
  // Covered indirectly: alternative spellings of a project id the Firebase
  // runtime check already accepts, cosmetic email fields carried by the
  // transactional-email check, QA switches that cannot engage in production,
  // and analytics and the portal's one-tap sign-in providers, which are
  // build-inlined choices rather than runtime capabilities (email and
  // password sign-in works without them).
  const indirect = new Set([
    "FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET",
    "KCPL_EMAIL_FROM_NAME", "KCPL_EMAIL_REPLY_TO",
    "KCPL_QA_AUTH_BYPASS", "KCPL_QA_MOCK_DATA", "KCPL_QA_EMAIL",
    "NEXT_PUBLIC_GA_MEASUREMENT_ID", "KCPL_UI_BASE", "NEXT_PUBLIC_KCPL_SIGN_IN_PROVIDERS",
  ]);

  const probeSource = readFileSync(new URL("../app/production-readiness.ts", import.meta.url), "utf8")
    + readFileSync(new URL("../app/admin/admin-security-config.ts", import.meta.url), "utf8");
  const uncovered = [...read]
    .filter((key) => !platform.has(key) && !indirect.has(key))
    .filter((key) => !probeSource.includes(key))
    .sort();
  assert.deepEqual(uncovered, [], "add a readiness check, or record why the variable needs none");
});

test("a Turnstile secret without its site key is reported as blocked", () => {
  // The form sends no token, the server still requires one, and every public
  // enquiry is refused with a 403. One unset variable takes down the funnel.
  const env = { ...completeEnv(), CLOUDFLARE_TURNSTILE_SECRET_KEY: "turnstile-secret-value" };
  delete env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
  const report = productionRuntimeReadiness(env);
  const challenge = report.checks.find((item) => item.id === "quote-challenge");
  assert.equal(challenge.status, "blocked");
  assert.equal(report.overall, "blocked");
});

test("a partially configured integration says so rather than reading as off", () => {
  const env = { ...completeEnv() };
  delete env.MAERSK_WEBHOOK_SECRET;
  const maersk = productionRuntimeReadiness(env).checks.find((item) => item.id === "maersk");
  assert.equal(maersk.status, "warning");
  assert.match(maersk.detail, /partially configured/i);
  assert.match(maersk.detail, /MAERSK_WEBHOOK_SECRET/);
});

test("no check leaks the value it is checking", () => {
  const env = { ...completeEnv(), KCPL_EDI_SECRET: "edi-secret-value", MAERSK_CONSUMER_KEY: "consumer-key-value" };
  const serialised = JSON.stringify(productionRuntimeReadiness(env));
  for (const secret of ["edi-secret-value", "consumer-key-value", "sendgrid-secret-value", "places-secret-value", "routes-secret-value", "0123456789abcdef0123456789abcdef"]) {
    assert.ok(!serialised.includes(secret), `readiness output leaked ${secret}`);
  }
});
