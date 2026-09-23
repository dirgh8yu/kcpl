// Keep app/sitemap-lastmod.json in step with the copy the site actually ships.
//
//   node scripts/sitemap-lastmod.mjs          check (used by the test suite)
//   node scripts/sitemap-lastmod.mjs --write  stamp today on pages whose copy changed
//
// A date only moves when that page's own dictionary entries change, so lastmod
// says what it claims to say and search engines can keep trusting it.
import { readFileSync, writeFileSync } from "node:fs";
import { fingerprintAll } from "../app/sitemap-content.ts";

const manifestPath = new URL("../app/sitemap-lastmod.json", import.meta.url);
const write = process.argv.includes("--write");
const today = new Date().toISOString().slice(0, 10);

let manifest = { entries: {} };
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  if (!write) {
    console.error("app/sitemap-lastmod.json is missing. Run: node scripts/sitemap-lastmod.mjs --write");
    process.exit(1);
  }
}

const current = fingerprintAll();
const stale = [];
const next = {};
for (const [key, fingerprint] of Object.entries(current)) {
  const previous = manifest.entries[key];
  if (previous && previous.fingerprint === fingerprint) {
    next[key] = previous;
    continue;
  }
  stale.push(key);
  next[key] = { fingerprint, lastmod: today };
}
const removed = Object.keys(manifest.entries).filter((key) => !(key in current));

if (write) {
  writeFileSync(manifestPath, `${JSON.stringify({ entries: next }, null, 2)}\n`);
  console.log(`sitemap lastmod: ${stale.length} page(s) restamped ${today}, ${removed.length} removed, ${Object.keys(next).length} total`);
} else if (stale.length || removed.length) {
  console.error(`sitemap lastmod is out of date: ${stale.length} changed, ${removed.length} removed.`);
  console.error(`  ${[...stale, ...removed].slice(0, 8).join(", ")}`);
  console.error("Run: node scripts/sitemap-lastmod.mjs --write");
  process.exit(1);
} else {
  console.log(`sitemap lastmod current for ${Object.keys(next).length} URLs.`);
}
