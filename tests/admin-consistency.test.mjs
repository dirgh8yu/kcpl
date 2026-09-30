import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { freightModeLabel } from "../app/admin/freight-mode.ts";
import { readable } from "../app/admin/readable.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

async function files(dir, ext = ".tsx") {
  const found = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await files(path, ext));
    else if (entry.name.endsWith(ext)) found.push(path);
  }
  return found;
}

/** Visible text only: drop comments and log lines. */
function visible(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line) && !/console\.(error|warn|log)/.test(line))
    .join("\n");
}

test("sidebar names are sentence case", async () => {
  const nav = await readFile(repo("app/admin/workflow-navigation.ts"), "utf8");
  const labels = [...nav.matchAll(/label: "([^"]+)", hub:/g)].map((match) => match[1]);
  assert.ok(labels.length > 20);
  const keep = /^(POD|EDI|Job|File|KCPL)$/;
  for (const label of labels) {
    const later = label.split(/\s+/).slice(1).filter((word) => /^[A-Z]/.test(word) && !keep.test(word));
    assert.deepEqual(later, [], `"${label}" should be sentence case`);
  }
});

test("each list page is headed with its sidebar name", async () => {
  const pages = {
    "app/admin/admin-dashboard.tsx": "Enquiries",
    "app/admin/finance/finance-workspace.tsx": "Receivables",
    "app/admin/payables/payables-workspace.tsx": "Payables",
    "app/admin/management/management-workspace.tsx": "Management",
    "app/admin/documents/documents-workspace.tsx": "Documents",
  };
  for (const [path, title] of Object.entries(pages)) {
    assert.match(await readFile(repo(path), "utf8"), new RegExp(`title="${title}"`), path);
  }
});

test("staff screens use one name for customers, partners and the shipment page", async () => {
  for (const path of await files("app/admin")) {
    const text = visible(await readFile(repo(path), "utf8"));
    assert.doesNotMatch(text, /Customer 360|Partner 360|CRM customer|CRM record|Freight Audit|Tender Workspace|Rate Desk\b|Transport Orders|Accounts Receivable/, path);
    assert.doesNotMatch(text, />(Open shipment|View shipment|Shipment record|Open job)</, path);
  }
});

test("an error screen is labelled with its page, not a product line", async () => {
  for (const path of await files("app/admin")) {
    const text = await readFile(repo(path), "utf8");
    for (const [, eyebrow] of text.matchAll(/eyebrow="(KCPL[^"]*)"/g)) {
      assert.equal(eyebrow, "KCPL Operations", `${path}: ${eyebrow}`);
    }
  }
});

test("a transport mode has one name", () => {
  assert.equal(freightModeLabel("ocean"), "Sea freight");
  assert.equal(freightModeLabel("sea"), "Sea freight");
  assert.equal(freightModeLabel("Air"), "Air freight");
  assert.equal(freightModeLabel(null), "Mode not set");
  assert.equal(readable("general_cargo"), "General cargo");
  assert.equal(readable(""), "");
});

test("record pages use the shared page header, not a hand-built one", async () => {
  for (const path of ["app/admin/rating/[order]/page.tsx", "app/admin/tenders/[tender]/page.tsx"]) {
    const source = await readFile(repo(path), "utf8");
    assert.match(source, /<OpsPageHeader/, path);
    assert.doesNotMatch(source, /text-\[23px\]|inline-flex h-8 items-center rounded/, path);
  }
});

test("one field, one button scale, one heading style", async () => {
  const css = await readFile(repo("app/admin/operations-system.css"), "utf8");
  // Fields: 34px (44px on phones), 13px regular, the app radius, labels 12px.
  assert.match(css, /--app-field-height: 34px;/);
  assert.match(css, /\.ops-field-label \{ margin: 0; color: var\(--admin-muted\); font-size: 12px;/);
  assert.match(css, /\.ops-field \{ display: grid; align-content: start;/);
  // Everything in a list toolbar is 32px; panel buttons are the small size.
  assert.match(css, /\.ops-register-toolbar-actions \.ops-button \{ min-height: 32px;/);
  assert.match(css, /\.ops-inspector-actions \.ops-button \{ min-height: 36px; padding-inline: 11px; font-size: 13px; \}/);
  // Buttons never wrap; notice buttons are readable.
  assert.match(css, /text-decoration: none; white-space: nowrap;/);
  assert.match(css, /\.ops-notice button \{ min-height: 28px;[^}]*font-size: 12px;/);
  assert.match(css, /\.ops-surface-header h2 \{ margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0\.01em;/);
});

test("every staff list table uses the register style", async () => {
  for (const path of await files("app/admin")) {
    const source = await readFile(repo(path), "utf8");
    for (const [, cls] of source.matchAll(/<table className="(ops-table[^"]*)"/g)) {
      assert.match(cls, /ops-register-table|shipments-register-table/, `${path}: ${cls}`);
    }
  }
});

test("one badge: no screen resizes it", async () => {
  // The three oldest sheets still carry their own base rule; everything
  // after them uses the single .kcpl-admin-content .ops-badge definition.
  const legacy = new Set(["operations-theme.css", "admin-design-system.css", "operations-polish.css"]);
  const sheets = (await files("app/admin", ".css")).filter((path) => !legacy.has(path.split("/").pop()));
  for (const path of sheets) {
    const css = await readFile(repo(path), "utf8");
    // Frozen sheets sit in @layer kcpl-legacy and lose to the unlayered rule.
    if (/^\s*(\/\*[^]*?\*\/\s*)?@layer kcpl-legacy/.test(css)) continue;
    for (const [rule] of css.matchAll(/[^\n{}]*\.ops-badge[^{]*\{[^}]*\}/g)) {
      if (rule.trim().startsWith("/*") || rule.includes(".kcpl-admin-content .ops-badge {")) continue;
      assert.doesNotMatch(rule, /min-height|font-size|padding/, `${path}: ${rule.trim().slice(0, 90)}`);
    }
  }
});

test("record pages read the same way: type, reference with status, route", async () => {
  const job = await readFile(repo("app/admin/jobs/[reference]/job-record.tsx"), "utf8");
  assert.match(job, /eyebrow="Shipment"/);
  assert.match(job, /title=\{<span className="job-record-title"><span className="ops-mono">\{job\.reference\}<\/span><OpsBadge/);
  const invoice = await readFile(repo("app/admin/finance/invoices/[reference]/invoice-workspace.tsx"), "utf8");
  assert.match(invoice, /eyebrow="Invoice" title=\{<span[^>]*><OpsMono>\{invoice\.reference\}<\/OpsMono><OpsBadge/);
  for (const path of ["app/admin/crm/[id]/customer-360-workspace.tsx", "app/admin/partners/[id]/partner-360-workspace.tsx"]) {
    assert.match(await readFile(repo(path), "utf8"), /title=\{<span className="inline-flex flex-wrap items-center gap-2">\{(customer|partner)\.display_name\}<OpsBadge/, path);
  }
});

test("an error screen's title is a page title", async () => {
  const css = await readFile(repo("app/admin/operations-system.css"), "utf8");
  assert.match(css, /\.workspace-gate-panel h1 \{ margin: 4px 0 0; font-size: var\(--app-title-size\); font-weight: 600;/);
  assert.match(css, /\.workspace-gate-panel \.workspace-gate-eyebrow \{ margin: 0; color: var\(--admin-muted\); font-size: 12px;/);
});
