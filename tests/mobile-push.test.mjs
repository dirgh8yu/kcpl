import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  customerPushTarget,
  mobileDeviceId,
  mobilePushPlatform,
  mobilePushToken,
  mobilePushTokenDead,
  staffNotificationPushes,
  staffPushTarget,
} from "../app/mobile-push-policy.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const token = "dQw4w9WgXcQ:APA91bH" + "x".repeat(120);

test("only a plausible FCM token and a known platform are accepted", () => {
  assert.equal(mobilePushToken(token), token);
  assert.equal(mobilePushToken(`  ${token} `), token);
  for (const bad of ["", "short", "has space in it but is otherwise long enough to pass the length rule", null, 42, "<script>".repeat(10)]) {
    assert.equal(mobilePushToken(bad), null, String(bad));
  }
  assert.equal(mobilePushPlatform("android"), "android");
  assert.equal(mobilePushPlatform("ios"), "ios");
  assert.equal(mobilePushPlatform("web"), null);
});

test("the same phone registering again is the same row, per app", () => {
  assert.equal(mobileDeviceId("customer", token), mobileDeviceId("customer", token));
  assert.notEqual(mobileDeviceId("customer", token), mobileDeviceId("staff", token));
  assert.doesNotMatch(mobileDeviceId("staff", token), /APA91/, "the raw token is not the document id");
});

test("a tap opens what the notification is about", () => {
  assert.deepEqual(customerPushTarget("https://kapileshworcargo.com.np/portal/shipments/KCPL-S-1"), { kind: "shipment", reference: "KCPL-S-1" });
  assert.deepEqual(customerPushTarget("https://kapileshworcargo.com.np/portal/invoices"), { kind: "alerts", reference: null });
  assert.deepEqual(staffPushTarget("/admin/jobs/KCPL-2609-0142?tab=tasks"), { kind: "job", reference: "KCPL-2609-0142" });
  assert.deepEqual(staffPushTarget("/admin/finance"), { kind: "alerts", reference: null });
});

test("staff are not buzzed about register transitions, nor about categories they muted", () => {
  const all = { assignments: true, tasks: true, shipments: true };
  assert.equal(staffNotificationPushes({ sourceType: "operational", category: "assignments", categories: all }), true);
  assert.equal(staffNotificationPushes({ sourceType: "register-transition", category: "shipments", categories: all }), false);
  assert.equal(staffNotificationPushes({ sourceType: "operational", category: "tasks", categories: { ...all, tasks: false } }), false);
});

test("only a gone token is dropped, not a passing failure", () => {
  assert.equal(mobilePushTokenDead("messaging/registration-token-not-registered"), true);
  assert.equal(mobilePushTokenDead("messaging/internal-error"), false);
  assert.equal(mobilePushTokenDead(undefined), false);
});

test("push delivery can never throw into the notification that carries the news", async () => {
  const source = code(await readFile(repo("app/mobile-push.server.ts"), "utf8"));
  for (const fn of ["export async function mobileDevicesFor", "export async function sendMobilePush"]) {
    const body = source.slice(source.indexOf(fn), source.indexOf("\nexport", source.indexOf(fn) + 10));
    assert.match(body, /try \{[\s\S]*\} catch/, `${fn} must catch`);
  }
  const staff = code(await readFile(repo("app/admin/notifications/notification-centre.server.ts"), "utf8"));
  const push = staff.slice(staff.indexOf("async function pushDirectNotification"));
  assert.match(push, /try \{[\s\S]*\} catch/);
  // Decided before any read, so the register's frequent writes cost nothing.
  assert.ok(push.indexOf("staffNotificationPushes(") < push.indexOf("mobileDevicesFor("));
});

test("a phone is registered against the verified login, never the request body", async () => {
  const customer = code(await readFile(repo("app/api/mobile/v1/push/route.ts"), "utf8"));
  assert.match(customer, /audience: "customer", email: session\.email, uid: session\.uid/);
  const staff = code(await readFile(repo("app/api/mobile/ops/v1/push/route.ts"), "utf8"));
  assert.match(staff, /audience: "staff", email: user\.email, uid: staff\.profile\.uid/);
  // Removing a device checks it belongs to the caller.
  const server = code(await readFile(repo("app/mobile-push.server.ts"), "utf8"));
  assert.match(server, /snapshot\.exists && snapshot\.get\("email"\) === email\.trim\(\)\.toLowerCase\(\)/);
});
