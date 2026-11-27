#!/usr/bin/env node
/*
 * Corridor backfill for customers converted before the corridor was copied.
 *
 * A quote already records the lane it came from (lane_slug, plus the attribution
 * block on older records). New conversions copy that onto the customer; this
 * script catches up the customers that converted earlier, so per-corridor win
 * rate can be read from customer data alone.
 *
 * Dry run by default. It prints what it would change and writes nothing:
 *
 *   node scripts/crm-corridor-backfill.mjs
 *   node scripts/crm-corridor-backfill.mjs --write
 *
 * Uses the same Firebase Admin credentials as the admin app
 * (GOOGLE_APPLICATION_CREDENTIALS, or a service account in the environment).
 * Safe to re-run: it only fills customers whose lane_slug is still empty, and
 * leaves every other field alone.
 */

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const write = process.argv.includes("--write");

const laneSlugs = new Set(["kolkata-to-birgunj", "haldia-to-kathmandu", "nepal-to-tibet"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function laneSlugFromPath(value) {
  const match = /^\/?(?:[a-z]{2}\/)?lanes\/([a-z0-9-]+)\/?$/.exec(text(value));
  return match && laneSlugs.has(match[1]) ? match[1] : "";
}

/* The same fallback the app uses: the stored slug first, then the lane path the
 * attribution block kept for quotes written before the slug was stored. */
function laneSlugOf(data) {
  const stored = text(data.lane_slug);
  if (laneSlugs.has(stored)) return stored;
  const attribution = data.attribution && typeof data.attribution === "object" ? data.attribution : {};
  return laneSlugFromPath(attribution.lane_path);
}

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();

let scanned = 0;
let candidates = 0;
let filled = 0;

let lastId = "";
for (;;) {
  const page = await db.collection("quotes").orderBy("__name__").startAfter(lastId).limit(300).get();
  if (page.empty) break;
  for (const doc of page.docs) {
    scanned += 1;
    lastId = doc.id;
    const quote = doc.data();
    const customerId = text(quote.customer_id);
    const laneSlug = laneSlugOf(quote);
    if (!customerId || !laneSlug) continue;
    const customerRef = db.collection("customers").doc(customerId);
    const customer = await customerRef.get();
    if (!customer.exists) continue;
    if (text(customer.get("lane_slug"))) continue;
    candidates += 1;
    const attribution = quote.attribution && typeof quote.attribution === "object" ? quote.attribution : {};
    const fields = {
      lane_slug: laneSlug,
      lane_origin: text(quote.lane_origin) || null,
      lane_destination: text(quote.lane_destination) || null,
      enquiry_source: text(attribution.source) || null,
    };
    console.log(`${customerId} <- ${doc.id}: ${laneSlug}`);
    if (write) {
      await customerRef.set(fields, { merge: true });
      filled += 1;
    }
  }
  if (page.size < 300) break;
}

console.log(`${write ? "Backfilled" : "Would backfill"} ${candidates} customer(s); written ${filled}; scanned ${scanned} quote(s).`);
if (!write && candidates) console.log("Re-run with --write to apply.");
process.exit(0);
