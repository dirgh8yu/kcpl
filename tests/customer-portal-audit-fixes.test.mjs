import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { portalQuoteBookingBlock, portalQuoteExpired } from "../app/portal/portal-access-policy.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

async function tsxFiles(dir) {
  const out = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await tsxFiles(path));
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

test("opening a shipment never scrolls the page to the conversation", async () => {
  // The thread keeps its newest message in view inside its own box. The
  // page-level scrollIntoView it used to call jumped a phone 1,300px down on
  // load, past the shipment's status and free time.
  const thread = code(await readFile(repo("app/shipment-thread.tsx"), "utf8"));
  assert.doesNotMatch(thread, /scrollIntoView/);
  assert.match(thread, /scrollTop = [a-z]+\.scrollHeight/);
});

test("every portal table stacks into rows on a phone instead of scrolling sideways", async () => {
  const css = await readFile(repo("app/admin/operations-system.css"), "utf8");
  assert.match(css, /@media \(max-width: 760px\) \{\s*\.kcpl-portal-route \.kcpl-admin-content \.ops-table\.portal-stack-table/);
  for (const path of await tsxFiles("app/portal")) {
    const source = await readFile(repo(path), "utf8");
    for (const table of source.match(/<table className="[^"]*"/g) ?? []) {
      assert.match(table, /portal-stack-table/, `${path}: ${table} must stack on phones`);
    }
    // Stacked cells say what they are; an unlabelled cell would lose its column.
    if (source.includes("portal-stack-table")) {
      const body = source.slice(source.indexOf("<tbody>"), source.lastIndexOf("</tbody>"));
      for (const cell of body.match(/<td(?=[\s>])[^>]*>/g) ?? []) {
        assert.match(cell, /data-cell="(primary|route|status|meta|amount|action|open)"/, `${path}: ${cell} needs a data-cell role`);
        if (cell.includes('data-cell="meta"')) assert.match(cell, /data-label=/, `${path}: ${cell} needs its column name`);
      }
    }
  }
});

test("the Nepali portal keeps a sans face for Latin text and figures", async () => {
  const css = await readFile(repo("app/admin/operations-system.css"), "utf8");
  const rule = /\.portal-shell\[data-locale="ne"\] \{ font-family: ([^;]+);/.exec(css);
  assert.ok(rule, "the Nepali font rule exists");
  // --font-devanagari is Noto Serif Devanagari: first in the stack, it set
  // English names and amounts in a serif too.
  assert.doesNotMatch(rule[1], /var\(--font-devanagari\)/);
  assert.match(rule[1], /^var\(--font-geist\).*var\(--font-devanagari-sans\)/);
});

test("a quote can be asked to proceed only while priced, unbooked, unasked and valid", () => {
  const now = new Date("2026-09-29T06:00:00Z"); // 11:45 in Kathmandu
  const quote = { quoted_amount: 168500, shipment_reference: null, valid_until: "2026-10-08", booking_requested_at: null };
  assert.equal(portalQuoteBookingBlock(quote, now), null);
  assert.equal(portalQuoteBookingBlock({ ...quote, quoted_amount: null }, now), "unpriced");
  assert.equal(portalQuoteBookingBlock({ ...quote, shipment_reference: "KCPL-S-1" }, now), "booked");
  assert.equal(portalQuoteBookingBlock({ ...quote, booking_requested_at: "2026-09-28T00:00:00Z" }, now), "requested");
  assert.equal(portalQuoteBookingBlock({ ...quote, valid_until: "2026-09-26" }, now), "expired");
  assert.equal(portalQuoteBookingBlock({ ...quote, valid_until: null }, now), null, "no expiry set is still open");
  // Valid all of its last day in Nepal, and not a minute past it.
  assert.equal(portalQuoteExpired("2026-09-29", new Date("2026-09-29T18:14:00Z")), false);
  assert.equal(portalQuoteExpired("2026-09-29", new Date("2026-09-29T18:16:00Z")), true);
});

test("the server refuses what the page does not offer", async () => {
  const server = code(await readFile(repo("app/portal/portal-requests.server.ts"), "utf8"));
  const booking = server.slice(server.indexOf("export async function requestPortalBooking"));
  assert.ok(booking.indexOf("portalQuoteBookingBlock(") > booking.indexOf("ownedByCustomer"), "checked after ownership");
  assert.ok(booking.indexOf("portalQuoteBookingBlock(") < booking.indexOf("batch.commit()"), "checked before anything is written");
  assert.match(booking, /status: 409/);
  const page = code(await readFile(repo("app/portal/requests/portal-requests-workspace.tsx"), "utf8"));
  assert.match(page, /!portalQuoteBookingBlock\(quote\) && capabilities\.canSubmitRequests/);
});

/* One interface for staff and customers --------------------------------- */

test("a shipment status has the same colour in the admin and the portal", async () => {
  const { portalStatusTone } = await import("../app/portal/portal-format.ts");
  const { shipmentStatusTone } = await import("../app/shipment-status-tone.ts");
  for (const status of ["booking_confirmed", "preparing", "in_transit", "customs_clearance", "out_for_delivery", "delivered", "exception"]) {
    assert.equal(portalStatusTone(status), shipmentStatusTone(status), status);
  }
  const admin = code(await readFile(repo("app/admin/shipments/shipments-views.tsx"), "utf8"));
  assert.match(admin, /return shipmentStatusTone\(status\);/);
});

test("the portal is built from the admin's register kit, not a look of its own", async () => {
  const files = await tsxFiles("app/portal");
  for (const path of files) {
    const source = code(await readFile(repo(path), "utf8"));
    assert.doesNotMatch(source, /OpsFilterChip|OpsKpiCard|OpsKpiStrip/, `${path}: use OpsScopeTabs / OpsKpiRail as the admin registers do`);
    for (const table of source.match(/<table className="[^"]*"/g) ?? []) {
      assert.match(table, /ops-register-table/, `${path}: ${table} uses the admin register table`);
    }
  }
  const overview = code(await readFile(repo("app/portal/portal-overview.tsx"), "utf8"));
  // Each number once: what is owed sits on the one "pay" row of the needs
  // list, and the shipment counts are the table's own line, not a rail.
  assert.doesNotMatch(overview, /<OpsKpiRail|<OpsMetricStrip/);
  assert.match(overview, /need\.kind !== "pay_open" \|\| !all\.some\(\(other\) => other\.kind === "pay_overdue"\)/);
  assert.match(overview, /t\("needs\.pay_owed", \{ amounts: owed \}\)/);
  assert.match(overview, /t\("overview\.movements_counts"/);
  // A shipment page asks for the missing paperwork before it reports, and
  // does not repeat the route, mode, status or opening date from its header.
  const detail = code(await readFile(repo("app/portal/shipments/[reference]/page.tsx"), "utf8"));
  assert.ok(detail.indexOf("{waiting ? exchange : null}") < detail.indexOf('t("ship.movement_title")'));
  assert.doesNotMatch(detail, /t\("ship\.opened_label"\)|label=\{t\("common\.status"\)\}/);
  for (const path of ["app/portal/shipments/portal-shipments-workspace.tsx", "app/portal/documents/portal-documents-workspace.tsx"]) {
    const source = code(await readFile(repo(path), "utf8"));
    assert.match(source, /<OpsRegisterToolbar/, path);
    assert.match(source, /<OpsScopeTabs/, path);
  }
  // Popovers from the kit open inside the portal's token scope too.
  const hook = await readFile(repo("app/admin/use-admin-portal-container.ts"), "utf8");
  assert.match(hook, /getElementById\("portal-content"\)/);
});
