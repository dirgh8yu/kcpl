import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { readFileSync } from "node:fs";

import { GET } from "../app/api/admin/attribution/tracker/route.ts";
import { clearTrackerEndpointTestHooks, setTrackerEndpointTestHooks } from "../app/api/admin/attribution/tracker/tracker-endpoint.ts";
import { trackerColumns } from "../app/api/quotes/quote-tracker.ts";
import { buildQuoteRecord } from "../app/api/quotes/quote-record.ts";
import { captureQuoteAttribution, sanitizeQuoteAttribution } from "../app/quote-attribution.ts";

/*
 * Route-level proof for the tracker download: it drives the real `GET` exported
 * by the route, with the session, role and record read replaced through the
 * documented test hook. No Firebase session, no network, no production data.
 */

const quote = {
  origin: "काठमाडौं",
  destination: "ल्हासा",
  mode: "road",
  cargoType: "FTL 8t",
  weight: "6400",
  weightUnit: "kg",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "cm",
  timing: "",
  requirements: "",
  contactName: "Tracker Test",
  contactEmail: "tracker@example.com",
  companyName: "Example Traders",
  phone: "",
};

function recordFor(reference, search, pathname) {
  return buildQuoteRecord({
    reference,
    createdAt: "2026-11-27T10:00:00.000Z",
    quote,
    attribution: sanitizeQuoteAttribution(captureQuoteAttribution({ search, referrer: "", pathname })),
    crmMatches: [],
  });
}

const laneRecord = recordFor("KCPL-Q-LANE", `?source=lane&from=${encodeURIComponent("/ne/lanes/nepal-to-tibet")}`, "/ne/quote");
const directRecord = recordFor("KCPL-Q-DIRECT", "", "/quote");

// 20:00 UTC on the 27th is already 01:45 on the 28th in Kathmandu, so a UTC
// slice of this instant would print the wrong day.
const CLOCK = new Date("2026-11-27T20:00:00.000Z");
const NEPAL_DAY = "2026-11-28";

/** Minimal RFC 4180 reader: quoted cells may hold commas and doubled quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (character !== "\r") cell += character;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function session({ kind = "authorized", role = "management", records = [laneRecord, directRecord] } = {}) {
  const calls = { role: 0, records: 0 };
  setTrackerEndpointTestHooks({
    access: async () => (kind === "authorized" ? { kind, user: { email: "ops@example.com" } } : { kind }),
    roleFor: async () => { calls.role += 1; return role; },
    records: async () => { calls.records += 1; return records; },
    now: () => CLOCK,
  });
  return calls;
}

afterEach(() => {
  clearTrackerEndpointTestHooks();
});

test("a management session downloads the tracker with Nepal's day in the filename", async () => {
  session();
  const response = await GET();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("content-disposition"),
    `attachment; filename="kcpl-quote-tracker-${NEPAL_DAY}.csv"`,
    "the day is Kathmandu's, not the UTC date of the same instant",
  );
});

test("the downloaded body is the tracker CSV, with the lane columns filled", async () => {
  session();
  const response = await GET();

  // The route prefixes a BOM so spreadsheet apps read the UTF-8 header.
  // `Response.text()` decodes with the BOM removed, so read the bytes: this is
  // the banner Excel actually sees on the wire.
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "a BOM keeps the Nepali cells readable in Excel");
  const body = new TextDecoder("utf-8").decode(bytes);
  const rows = parseCsv(body.trimEnd());

  const templateHeader = readFileSync(new URL("../docs/quote-tracker.csv", import.meta.url), "utf8").split("\n")[0];
  assert.deepEqual(rows[0], templateHeader.split(","));
  assert.deepEqual(rows[0], [...trackerColumns]);

  assert.equal(rows.length, 3, "header plus the two generated records");
  const laneRow = Object.fromEntries(rows[0].map((column, index) => [column, rows[1][index]]));
  const directRow = Object.fromEntries(rows[0].map((column, index) => [column, rows[2][index]]));

  assert.equal(laneRow.reference, "KCPL-Q-LANE");
  assert.equal(laneRow.origin, "काठमाडौं");
  assert.equal(laneRow.destination, "ल्हासा");
  assert.equal(laneRow.lane_slug, "nepal-to-tibet");
  assert.equal(laneRow.lane_origin, "Kathmandu");
  assert.equal(laneRow.lane_destination, "Lhasa");
  assert.equal(laneRow.source, "lane");
  assert.equal(laneRow.weight_kg, "6400");

  assert.equal(directRow.reference, "KCPL-Q-DIRECT");
  assert.equal(directRow.lane_slug, "");
  assert.equal(directRow.lane_origin, "");
  assert.equal(directRow.lane_destination, "");
});

test("an unauthenticated request is refused before any role or record read", async () => {
  const calls = session({ kind: "denied" });
  const response = await GET();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Sign in is required.");
  assert.equal(calls.role, 0, "no staff lookup without a session");
  assert.equal(calls.records, 0, "no quote read without a session");
});

test("a signed-in non-management role is refused", async () => {
  const calls = session({ role: "operations" });
  const response = await GET();
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Management access is required.");
  assert.equal(calls.records, 0, "the quote book is not read for a refused role");
});

test("unavailable quote records answer 503 rather than an empty file", async () => {
  session({ records: null });
  const response = await GET();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "Quote records are unavailable.");
  assert.equal(response.headers.get("content-type")?.includes("text/csv"), false);
});
