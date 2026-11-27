#!/usr/bin/env node
/*
 * Fill 90-day/quote-tracker.csv rows from exported quote records.
 *
 *   node --experimental-strip-types scripts/quote-tracker.mjs quotes.json [out.csv]
 *
 * The input is the JSON an operator exports from the `quotes` collection: an
 * array of documents, or `{ "quotes": [ ... ] }`. Output is the tracker's own
 * column order, with the lane columns (`lane_slug`, `lane_origin`,
 * `lane_destination`) already filled from the quote's lane attribution, so a
 * row can be pasted into the tracker without anyone guessing where attribution
 * belongs. Columns the quote does not capture are left blank.
 *
 * Records without a lane leave those three columns empty: an enquiry from
 * /services or a direct visit is not a corridor enquiry.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { trackerCsv } from "../app/api/quotes/quote-tracker.ts";

const [, , input, output] = process.argv;

if (!input) {
  console.error("usage: node --experimental-strip-types scripts/quote-tracker.mjs <quotes.json> [out.csv]");
  process.exit(2);
}

const parsed = JSON.parse(readFileSync(input, "utf8"));
const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.quotes) ? parsed.quotes : [parsed];
const csv = trackerCsv(records);

if (output) {
  writeFileSync(output, csv);
  console.log(`quote tracker: ${records.length} row(s) written to ${output}`);
} else {
  process.stdout.write(csv);
}
