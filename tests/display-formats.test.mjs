import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const repo = (path) => new URL(`../${path}`, import.meta.url);
async function sources(dir) {
  const out = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await sources(path));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".server.ts")) out.push(path);
  }
  return out;
}

// One clock per product: the staff workspace reads "2:30 pm", the portal
// "14:30". A 24-hour display in the staff workspace was the odd one out on
// the pages that mixed both. (Datetime inputs still need hourCycle h23 for
// their value; that is a value, not a display.)
test("staff pages show times on the 12-hour clock", async () => {
  const offenders = [];
  for (const path of await sources("app/admin")) {
    if ((await readFile(repo(path), "utf8")).includes("hour12: false")) offenders.push(path);
  }
  assert.deepEqual(offenders, []);
});

test("a message shows in the reader's own product's clock, in Nepal time", async () => {
  const thread = await readFile(repo("app/shipment-thread.tsx"), "utf8");
  assert.match(thread, /new Intl\.DateTimeFormat\(viewer === "customer" \? "en-GB" : "en-AU", \{[^}]*timeZone: "Asia\/Kathmandu" \}\)/);
  assert.match(thread, /when\(message\.created_at, viewer\)/);
});

test("dates stored as full timestamps never print raw", async () => {
  for (const path of ["app/admin/crm/[id]/crm-rate-card-panel.tsx", "app/admin/partners/[id]/partner-360-workspace.tsx"]) {
    const source = await readFile(repo(path), "utf8");
    assert.match(source, /const plainDay = \/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(value\);/, path);
  }
  const wallboard = await readFile(repo("app/admin/wallboard/wallboard-view.tsx"), "utf8");
  assert.doesNotMatch(wallboard, /Snapshot \{generatedAt\}/);
});
