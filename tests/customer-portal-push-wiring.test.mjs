import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { pushSubscriptionId } from "../app/portal/portal-push-crypto.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ------------------------------------------------------------------ *
 * Subscription identity
 * ------------------------------------------------------------------ */

test("the same browser re-subscribing replaces its row rather than doubling it", () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
  assert.equal(pushSubscriptionId(endpoint), pushSubscriptionId(` ${endpoint} `));
  // Two phones are two subscriptions; one phone twice is one.
  assert.notEqual(pushSubscriptionId(endpoint), pushSubscriptionId(`${endpoint}x`));
});

test("a subscription id is safe as a Firestore document id", () => {
  const id = pushSubscriptionId("https://updates.push.services.mozilla.com/wpush/v2/gAAAAA_/+?x=1");
  assert.match(id, /^[0-9a-f]{48}$/);
});

/* ------------------------------------------------------------------ *
 * Push is a transport, not a second policy
 * ------------------------------------------------------------------ */

test("push reuses the notification key, so it cannot send what email would not", async () => {
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  // Each of the three facts computes one key and hands it to both transports.
  assert.equal((sweep.match(/await pushOnce\(\{/g) ?? []).length, 3);
  assert.equal((sweep.match(/const key = portalNotificationKey\(\{/g) ?? []).length, 3);
  assert.match(sweep, /await sendOnce\(\{\s*key,/);
  assert.match(sweep, /await pushOnce\(\{\s*key,/);
  // Whether a customer hears about a fact stays in the pure policy module.
  assert.doesNotMatch(sweep, /portalPushConfigured\(\) &&[\s\S]{0,80}notifiable/i);
});

test("a fact is claimed once per recipient before any push goes out", async () => {
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  const push = sweep.slice(sweep.indexOf("async function pushOnce"));
  // create() rather than set(): losing the race means another sweep owns it,
  // exactly as for email, so a phone and a laptop each get one notification.
  assert.match(push, /collection\("portal_push_deliveries"\)/);
  assert.match(push, /await reference\.create\(\{/);
  assert.match(push, /\} catch \{\s*return;/);
});

test("push failures never cost the email carrying the same news", async () => {
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  const push = sweep.slice(sweep.indexOf("async function pushOnce"), sweep.indexOf("async function sendOnce"));
  // No throw path: an unconfigured deployment and an empty subscription list
  // both return quietly, and delivery failures are handled inside the module.
  assert.match(push, /if \(!portalPushConfigured\(\)\) return;/);
  assert.match(push, /if \(!targets\.length\) return;/);
  assert.doesNotMatch(push, /throw /);
});

test("subscriptions are read once per sweep, not once per shipment", async () => {
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  assert.equal((sweep.match(/portalPushSubscriptionsByEmail\(\)/g) ?? []).length, 1);
  const before = sweep.indexOf("portalPushSubscriptionsByEmail()");
  const loop = sweep.indexOf("for (const [customerId, customerAccounts] of byCustomer)");
  assert.ok(before > -1 && before < loop, "the subscription read must sit outside the per-customer loop");
});

test("each device is pushed to in the language of the account that registered it", async () => {
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  assert.match(sweep, /lang: input\.account\.locale/);
});

/* ------------------------------------------------------------------ *
 * A subscription belongs to one account
 * ------------------------------------------------------------------ */

test("the route files a subscription against the session, never the request", async () => {
  const route = code(await readFile(repo("app/api/portal/push/route.ts"), "utf8"));
  assert.match(route, /email: access\.session\.email/);
  assert.match(route, /customerId: access\.session\.customerId/);
  assert.doesNotMatch(route, /body\.email|body\.customerId/);
  assert.match(route, /isTrustedSameOriginRequest/);
});

test("knowing an endpoint is not enough to silence someone else's phone", async () => {
  const server = code(await readFile(repo("app/portal/portal-push.server.ts"), "utf8"));
  const remove = server.slice(server.indexOf("export async function deletePortalPushSubscription"));
  assert.match(remove, /snapshot\.get\("email"\) !== email/);
  assert.match(remove, /return \{ kind: "forbidden" as const \}/);
});

test("a dead endpoint is dropped rather than retried forever", async () => {
  const server = code(await readFile(repo("app/portal/portal-push.server.ts"), "utf8"));
  // 404 and 410 are the push service saying the subscription no longer exists.
  assert.match(server, /response\.status === 404 \|\| response\.status === 410/);
  assert.match(server, /await dropSubscription\(subscription\.id\)/);
});

test("push stays off unless every VAPID value is configured", async () => {
  const server = code(await readFile(repo("app/portal/portal-push.server.ts"), "utf8"));
  assert.match(server, /if \(!publicKey \|\| !privateKey \|\| !subject\) return null;/);
  const route = code(await readFile(repo("app/api/portal/push/route.ts"), "utf8"));
  assert.match(route, /if \(!portalPushConfigured\(\)\) return json\([^)]*503\)/);
});

/* ------------------------------------------------------------------ *
 * The installable portal
 * ------------------------------------------------------------------ */

test("the manifest describes the portal, not the whole site", async () => {
  const manifest = JSON.parse(await readFile(repo("public/portal.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "/portal");
  assert.equal(manifest.scope, "/portal");
  assert.equal(manifest.display, "standalone");
  // Installability needs an icon of at least 192px.
  const png = manifest.icons.find((icon) => icon.type === "image/png");
  assert.ok(png, "a raster icon is required for installability");
  const [width] = png.sizes.split("x").map(Number);
  assert.ok(width >= 192, `icon is ${png.sizes}`);
});

test("the manifest is declared on the portal only", async () => {
  const portalLayout = await readFile(repo("app/portal/layout.tsx"), "utf8");
  assert.match(portalLayout, /manifest: "\/portal\.webmanifest"/);
  // Offering to install the marketing site would be a prompt with nothing
  // behind it. Each language has its own root layout now, so every public root
  // and the document they share has to stay clear of the manifest.
  for (const root of ["app/site-document.tsx", "app/(en)/layout.tsx", "app/ne/layout.tsx", "app/zh/layout.tsx", "app/hi/layout.tsx"]) {
    assert.doesNotMatch(await readFile(repo(root), "utf8"), /webmanifest/, `${root} must not declare the portal manifest`);
  }
});

test("the service worker caches nothing", async () => {
  const worker = await readFile(repo("public/portal-sw.js"), "utf8");
  // A cached shipment status is a wrong shipment status. Telling someone
  // their cargo is in transit when it was delivered yesterday is worse than
  // telling them the page will not load.
  assert.doesNotMatch(worker, /caches\.|cache\.put|cache\.match/);
  assert.doesNotMatch(worker, /addEventListener\("fetch"/);
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /addEventListener\("notificationclick"/);
});

test("a notification click focuses an open portal tab rather than opening another", async () => {
  const worker = await readFile(repo("public/portal-sw.js"), "utf8");
  assert.match(worker, /matchAll\(\{ type: "window"/);
  assert.match(worker, /client\.focus\(\)/);
  assert.match(worker, /openWindow/);
});

test("a malformed push payload is ignored rather than guessed at", async () => {
  const worker = await readFile(repo("public/portal-sw.js"), "utf8");
  assert.match(worker, /try \{[\s\S]{0,120}event\.data\.json\(\)[\s\S]{0,120}catch/);
});

test("the permission prompt is only raised from the button", async () => {
  const control = await readFile(repo("app/portal/portal-push-control.tsx"), "utf8");
  const effect = control.slice(control.indexOf("useEffect("), control.indexOf("async function enable"));
  // A permission asked for on page load is the fastest way to have it denied
  // permanently, and a denied permission cannot be re-requested from script.
  assert.doesNotMatch(effect, /requestPermission/);
  assert.match(control.slice(control.indexOf("async function enable")), /Notification\.requestPermission\(\)/);
});

test("a subscription the server rejected is undone in the browser too", async () => {
  const control = await readFile(repo("app/portal/portal-push-control.tsx"), "utf8");
  // Registered with the browser but not with KCPL is a subscription that
  // would never be pushed to.
  assert.match(control, /await subscription\.unsubscribe\(\);\s*throw new Error/);
});
