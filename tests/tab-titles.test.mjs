import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { recordTitle } from "../app/record-title.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

async function pages(dir) {
  const found = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await pages(path));
    else if (entry.name === "page.tsx") found.push(path);
  }
  return found;
}

test("each product names its tabs once, with its own suffix", async () => {
  const admin = await readFile(repo("app/admin/layout.tsx"), "utf8");
  assert.match(admin, /title: \{ default: "KCPL Operations", template: "%s · KCPL Operations" \}/);
  const portal = await readFile(repo("app/portal/layout.tsx"), "utf8");
  assert.match(portal, /title: \{ default: "KCPL Customer Portal", template: "%s · KCPL Customer Portal" \}/);
});

test("a page title is the page's name; the layout adds the product", async () => {
  // The two home pages share their layout's segment, so the template does not
  // reach them and they carry the product name themselves.
  const homes = new Set(["app/admin/page.tsx", "app/portal/page.tsx"]);
  for (const path of [...await pages("app/admin"), ...await pages("app/portal")]) {
    if (homes.has(path)) continue;
    const source = await readFile(repo(path), "utf8");
    const titles = [...source.matchAll(/^\s*(?:export const metadata[^\n]*)?title: "([^"]+)"/gm)].map((match) => match[1]);
    for (const title of titles) {
      assert.doesNotMatch(title, /KCPL|Kapileshwor|\|/, `${path}: "${title}" repeats the suffix the layout adds`);
    }
  }
});

test("a record's tab shows its reference", async () => {
  for (const path of [
    "app/admin/jobs/[reference]/page.tsx",
    "app/admin/finance/invoices/[reference]/page.tsx",
    "app/admin/payables/bills/[reference]/page.tsx",
    "app/admin/partners/[id]/page.tsx",
    "app/portal/shipments/[reference]/page.tsx",
    "app/portal/invoices/[reference]/page.tsx",
  ]) {
    const source = await readFile(repo(path), "utf8");
    assert.match(source, /export async function generateMetadata/, path);
    assert.match(source, /recordTitle\(\(await params\)\./, path);
  }
  assert.equal(recordTitle("KCPL-S-24091"), "KCPL-S-24091");
  assert.equal(recordTitle("INV%2F2026%2F01"), "INV/2026/01");
  assert.equal(recordTitle("%E0%A4"), "%E0%A4", "a malformed reference is shown as it came");
  assert.equal(recordTitle("x".repeat(200)).length, 60);
});
