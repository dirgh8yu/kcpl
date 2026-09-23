import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { guides, guideSlugs } from "../app/guide-data.ts";
import { fingerprintAll, sitemapPaths } from "../app/sitemap-content.ts";
import { siteLocales } from "../app/site-i18n.ts";

const manifest = JSON.parse(readFileSync(new URL("../app/sitemap-lastmod.json", import.meta.url), "utf8"));

test("every sitemap URL has a recorded lastmod", () => {
  const expected = sitemapPaths().flatMap((path) => siteLocales.map((locale) => `${locale}${path}`));
  assert.equal(Object.keys(manifest.entries).length, expected.length);
  for (const key of expected) assert.ok(manifest.entries[key], `no lastmod recorded for ${key}`);
});

test("recorded lastmod still matches the copy the site ships", () => {
  // The whole value of lastmod is that it is true. If copy changed without the
  // manifest being restamped the date would be a lie, so that fails here rather
  // than shipping to a crawler.
  const current = fingerprintAll();
  const drifted = Object.entries(current).filter(([key, fingerprint]) => manifest.entries[key]?.fingerprint !== fingerprint);
  assert.deepEqual(drifted.map(([key]) => key), [], "run: node scripts/sitemap-lastmod.mjs --write");
});

test("a page's date tracks its own copy and nothing else", () => {
  // The guarantee that makes the field trustworthy: pages are fingerprinted
  // from their own namespaced dictionary entries, so two different pages in the
  // same language cannot share a fingerprint by accident.
  const english = Object.entries(fingerprintAll()).filter(([key]) => key.startsWith("en/"));
  assert.equal(new Set(english.map(([, fingerprint]) => fingerprint)).size, english.length);
});

test("every date is a real calendar day, not a build timestamp", () => {
  for (const [key, entry] of Object.entries(manifest.entries)) {
    assert.match(entry.lastmod, /^\d{4}-\d{2}-\d{2}$/, `${key} has a malformed date`);
    assert.ok(!Number.isNaN(Date.parse(`${entry.lastmod}T00:00:00Z`)), `${key} has an unparseable date`);
  }
});

test("both freight guides are substantial and available in every site language", () => {
  for (const slug of guideSlugs) {
    assert.ok(sitemapPaths().includes(`/guides/${slug}`));
    for (const locale of siteLocales) {
      const guide = guides[locale][slug];
      assert.ok(guide.title && guide.description && guide.intro, `${locale}/${slug} is missing SEO copy`);
      assert.equal(guide.stages.length, 3, `${locale}/${slug} is missing a planning stage`);
      assert.ok(guide.documents.length >= 4, `${locale}/${slug} is missing its checklist`);
      assert.equal(guide.questions.length, 2, `${locale}/${slug} is missing a planning answer`);
    }
  }
});
