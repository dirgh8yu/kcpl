import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { guides, guideSlugs } from "../app/guide-data.ts";
import { depthReferenceCopy, guideDepth, serviceDepth } from "../app/content-depth.ts";
import { fingerprintAll, sitemapPaths } from "../app/sitemap-content.ts";
import { siteDictionary, siteLocales } from "../app/site-i18n.ts";

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

test("every freight guide is substantial and available in every site language", () => {
  assert.ok(sitemapPaths().includes("/guides"));
  for (const slug of guideSlugs) {
    assert.ok(sitemapPaths().includes(`/guides/${slug}`));
    for (const locale of siteLocales) {
      const guide = guides[locale][slug];
      assert.ok(guide.title && guide.description && guide.intro, `${locale}/${slug} is missing SEO copy`);
      assert.equal(guide.stages.length, 3, `${locale}/${slug} is missing a planning stage`);
      assert.ok(guide.documents.length >= 4, `${locale}/${slug} is missing its checklist`);
      assert.ok(guide.questions.length >= 2 && guide.questions.length <= 4, `${locale}/${slug} needs two to four planning answers`);
    }
  }
});

test("every guide points somewhere real: its service, its calculator and other guides", async () => {
  const { guideLinks } = await import("../app/guide-data.ts");
  const { toolSlugs } = await import("../app/tool-data.ts");
  const paths = sitemapPaths();
  for (const slug of guideSlugs) {
    const links = guideLinks[slug];
    assert.ok(paths.includes(links.service), `${slug} links to ${links.service}, which is not a page`);
    assert.ok(toolSlugs.includes(links.tool), `${slug} links to an unknown tool`);
    assert.ok(links.next.length >= 1 && !links.next.includes(slug), `${slug} must lead to other guides`);
    for (const next of links.next) assert.ok(guideSlugs.includes(next), `${slug} links to unknown guide ${next}`);
  }
});

test("services-index metadata does not restamp service detail pages", () => {
  const dictionary = siteDictionary("en");
  const original = dictionary["services.meta_description"];
  const before = fingerprintAll();
  try {
    dictionary["services.meta_description"] = `${original} Test-only metadata change.`;
    const after = fingerprintAll();
    assert.deepEqual(Object.keys(after).filter((key) => after[key] !== before[key]), ["en/services"]);
  } finally {
    dictionary["services.meta_description"] = original;
  }
});

test("a depth edit changes only its English page fingerprint", () => {
  const cases = [
    ...Object.entries(guideDepth).map(([slug, content]) => [`en/guides/${slug}`, content]),
    ...Object.entries(serviceDepth).map(([slug, content]) => [`en/services/${slug}`, content]),
  ];
  for (const [expected, content] of cases) {
    const before = fingerprintAll();
    const paragraphs = content.sections[0].paragraphs;
    const original = paragraphs[0];
    try {
      paragraphs[0] = `${original} Test-only editorial change.`;
      const after = fingerprintAll();
      const changed = Object.keys(after).filter((key) => after[key] !== before[key]);
      assert.deepEqual(changed, [expected], `${expected} must not restamp other pages or translations`);
    } finally {
      paragraphs[0] = original;
    }
  }
});

test("shared reference copy restamps only the English pages that render it", () => {
  const before = fingerprintAll();
  const original = depthReferenceCopy.intro;
  const expected = [
    ...Object.entries(guideDepth).filter(([, content]) => content.sources.length).map(([slug]) => `en/guides/${slug}`),
    ...Object.entries(serviceDepth).filter(([, content]) => content.sources.length).map(([slug]) => `en/services/${slug}`),
  ].sort();
  try {
    depthReferenceCopy.intro = `${original} Test-only editorial change.`;
    const after = fingerprintAll();
    assert.deepEqual(Object.keys(after).filter((key) => after[key] !== before[key]).sort(), expected);
  } finally {
    depthReferenceCopy.intro = original;
  }
});
