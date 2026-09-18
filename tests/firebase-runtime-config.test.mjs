import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const CONFIG_KEYS = [
  "FIREBASE_CONFIG",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
];

function clearConfigKeys() {
  for (const key of CONFIG_KEYS) delete process.env[key];
}

// Node coerces any non-string assigned to process.env into a string, so a
// `||= undefined` write stores "undefined" and makes every `Boolean(process.env.X)`
// configuration gate in the app read as configured. These tests keep that from
// coming back, because the failure mode is a 500 on an otherwise gated route.
test("a runtime without FIREBASE_CONFIG reports itself unconfigured", async () => {
  clearConfigKeys();
  const admin = await import("../app/firebase-admin.server.ts?env=none");

  assert.equal(admin.firebaseRuntimeConfigured(), false);
  assert.equal(admin.firebaseStorageBucketName(), "");
});

test("importing the admin SDK never writes placeholder values into the environment", async () => {
  clearConfigKeys();
  await import("../app/firebase-admin.server.ts?env=no-placeholders");

  for (const key of CONFIG_KEYS) {
    assert.notEqual(process.env[key], "undefined", `${key} must never hold the string "undefined"`);
    assert.notEqual(process.env[key], "null", `${key} must never hold the string "null"`);
  }
});

test("injected FIREBASE_CONFIG still supplies the project and storage bucket", async () => {
  clearConfigKeys();
  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: "kcpl-production",
    storageBucket: "kcpl-production.firebasestorage.app",
  });
  const admin = await import("../app/firebase-admin.server.ts?env=injected");

  assert.equal(admin.firebaseRuntimeConfigured(), true);
  assert.equal(admin.firebaseStorageBucketName(), "kcpl-production.firebasestorage.app");
  assert.equal(process.env.FIREBASE_PROJECT_ID, "kcpl-production");
  clearConfigKeys();
});

// /admin/staff and /admin/migration/recovery were the only two admin routes that failed with
// "Unable to detect a Project Id" instead of rendering their existing unavailable states,
// because these loaders reached Firestore whenever firebaseRuntimeConfigured() claimed a
// configured runtime. They must keep gating on that check *before* the Firestore call.
test("admin loaders gate on firebaseRuntimeConfigured before touching Firestore", () => {
  for (const [file, loader] of [
    ["app/admin/staff-directory.server.ts", "listStaffProfiles"],
    ["app/admin/migration/migration-batches.server.ts", "listMigrationBatches"],
  ]) {
    const source = readFileSync(file, "utf8");
    const body = source.slice(source.indexOf(`export async function ${loader}`));
    assert.ok(body, `${loader} must still exist in ${file}`);

    const guard = body.indexOf("if (!firebaseRuntimeConfigured()) return null;");
    const firestore = body.indexOf("firebaseAdminDb()");
    assert.notEqual(guard, -1, `${loader} must gate on firebaseRuntimeConfigured()`);
    assert.ok(guard < firestore, `${loader} must check configuration before creating a Firestore client`);
  }
});

test("a blank or placeholder storage bucket is treated as absent", async () => {
  clearConfigKeys();
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "kcpl-production" });
  process.env.FIREBASE_STORAGE_BUCKET = "undefined";
  const admin = await import("../app/firebase-admin.server.ts?env=placeholder-bucket");

  assert.equal(admin.firebaseStorageBucketName(), "");
  assert.equal(admin.firebaseRuntimeConfigured(), true);
  clearConfigKeys();
});
