import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { trackerColumns, trackerCsv, trackerRow } from "../app/api/quotes/quote-tracker.ts";
import { buildQuoteRecord } from "../app/api/quotes/quote-record.ts";
import { captureQuoteAttribution, sanitizeQuoteAttribution } from "../app/quote-attribution.ts";

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
  contactName: "Test Enquirer",
  contactEmail: "test@example.com",
  companyName: "Example Traders, Pvt. Ltd.",
  phone: "",
};

function recordFor(search, pathname) {
  return buildQuoteRecord({
    reference: "KCPL-Q-20261127-TRACK001",
    createdAt: "2026-11-27T10:00:00.000Z",
    quote,
    attribution: sanitizeQuoteAttribution(captureQuoteAttribution({ search, referrer: "", pathname })),
    crmMatches: [],
  });
}

const laneRecord = recordFor(`?source=lane&from=${encodeURIComponent("/ne/lanes/nepal-to-tibet")}`, "/ne/quote");
const directRecord = recordFor("", "/quote");

test("the template header is the generator's column order", () => {
  const template = readFileSync(new URL("../docs/quote-tracker.csv", import.meta.url), "utf8");
  const [header, ...rows] = template.trimEnd().split("\n");
  assert.equal(header, trackerColumns.join(","));
  // Every example row fills every column, so a copy lands in the right cells.
  for (const row of rows) {
    assert.equal(row.split(",").length, trackerColumns.length, row.slice(0, 40));
  }
  assert.ok(rows.some((row) => row.includes("nepal-to-tibet")), "an example shows the lane form");
  assert.ok(rows.some((row) => row.includes("/guides/")), "an example shows a non-lane enquiry");
});

test("a lane enquiry fills the corridor beside the localized words", () => {
  const row = trackerRow(laneRecord);
  assert.equal(row.reference, "KCPL-Q-20261127-TRACK001");
  assert.equal(row.received_at, "2026-11-27T10:00:00.000Z");
  assert.equal(row.source, "lane");
  assert.equal(row.landing_path, "/ne/quote");
  assert.equal(row.origin, "काठमाडौं");
  assert.equal(row.destination, "ल्हासा");
  assert.equal(row.lane_slug, "nepal-to-tibet");
  assert.equal(row.lane_origin, "Kathmandu");
  assert.equal(row.lane_destination, "Lhasa");
  assert.equal(row.weight_kg, "6400");
});

test("an enquiry without a lane leaves the corridor columns empty", () => {
  const row = trackerRow(directRecord);
  assert.equal(row.source, "direct");
  assert.equal(row.lane_slug, "");
  assert.equal(row.lane_origin, "");
  assert.equal(row.lane_destination, "");
});

test("a record written before the corridor columns existed is filled from lane_path", () => {
  const row = trackerRow({
    reference: "KC-LEGACY",
    origin: "काठमाडौं",
    destination: "ल्हासा",
    attribution: { source: "lane", lane_path: "/ne/lanes/nepal-to-tibet", landing_path: "/ne/quote" },
  });
  assert.equal(row.lane_slug, "nepal-to-tibet");
  assert.equal(row.lane_origin, "Kathmandu");
  assert.equal(row.lane_destination, "Lhasa");
});

test("the lane index and non-kg weights stay blank rather than guessed", () => {
  const indexRow = trackerRow(recordFor(`?source=lane&from=${encodeURIComponent("/lanes")}`, "/quote"));
  assert.equal(indexRow.lane_slug, "");
  const pounds = trackerRow({ ...laneRecord, weight_unit: "lb" });
  assert.equal(pounds.weight_kg, "");
});

test("commas and quotes in a value stay inside one cell", () => {
  const csv = trackerCsv([{ reference: "A,B", company_name: 'He said "hi"', created_at: "2026-01-01T00:00:00Z" }]);
  const line = csv.split("\n")[1];
  assert.ok(line.startsWith('"A,B",2026-01-01T00:00:00Z'), line.slice(0, 60));
  assert.ok(line.includes('"He said ""hi"""'), line.slice(0, 200));
  assert.equal(csv.trimEnd().split("\n").length, 2, "one header and one row, despite the commas inside cells");
});

test("the script writes a tracker file from exported quotes", () => {
  const dir = mkdtempSync(join(tmpdir(), "kcpl-tracker-"));
  const input = join(dir, "quotes.json");
  const output = join(dir, "out.csv");
  writeFileSync(input, JSON.stringify({ quotes: [laneRecord, directRecord] }));
  const run = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/quote-tracker.mjs", input, output], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const csv = readFileSync(output, "utf8");
  const [header, ...rows] = csv.trimEnd().split("\n");
  assert.equal(header, trackerColumns.join(","));
  assert.equal(rows.length, 2);
  assert.ok(rows[0].includes("nepal-to-tibet"));
  assert.equal(trackerRow(directRecord).lane_slug, "");
});
