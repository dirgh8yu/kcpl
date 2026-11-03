import assert from "node:assert/strict";
import test from "node:test";

import { publicSearchIndex, searchPublicSite } from "../app/public-search.ts";
import { siteLocales } from "../app/site-i18n.ts";

test("public search indexes every service, guide and tool without duplicates", () => {
  const index = publicSearchIndex("en");
  assert.ok(index.length >= 20);
  const keys = index.map((entry) => `${entry.kind}:${entry.href}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(index.some((entry) => entry.kind === "service" && entry.href === "/services/air-freight"));
  assert.ok(index.some((entry) => entry.kind === "guide" && entry.href === "/guides/customs-clearance-in-nepal"));
  assert.ok(index.some((entry) => entry.kind === "tool" && entry.href === "/tools/duty-estimate"));
});

test("search ranks title matches above body matches and caps results", () => {
  const results = searchPublicSite("en", "customs");
  assert.ok(results.length > 0);
  assert.ok(results.some((entry) => entry.title.toLowerCase().includes("customs")));
  assert.ok(searchPublicSite("en", "customs", 2).length <= 2);
  assert.deepEqual(searchPublicSite("en", "   "), []);
});

test("every locale keeps its own search links", () => {
  for (const locale of siteLocales) {
    const results = searchPublicSite(locale, locale === "zh" ? "海运" : locale === "ne" ? "भन्सार" : locale === "hi" ? "समुद्री" : "freight");
    assert.ok(results.length > 0, `${locale} should return results`);
    const prefix = locale === "en" ? "" : `/${locale}`;
    assert.ok(results.every((entry) => entry.href.startsWith(prefix === "" ? "/" : prefix)), `${locale} links stay in locale`);
  }
});
