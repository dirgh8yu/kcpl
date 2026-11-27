import assert from "node:assert/strict";
import test from "node:test";
import {
  adminGuardProblems,
  blogPostProblems,
  jsonLdNodes,
  laneHrefs,
  laneIndexProblems,
  lanePageProblems,
  laneSlugs,
  locales,
  quotePageProblems,
  sitemapProblems,
} from "../scripts/smoke-checks.mjs";
import { laneIndexItemListNode } from "../app/lane-index-schema.ts";
import { laneFor } from "../app/lane-data.ts";

/* The smoke check is only useful if it fails when the site regresses, so each
 * assertion is tested in both directions: the good page passes, and a page that
 * lost its schema, a lane link or its auth guard does not. */

const origin = "https://kapileshworcargo.com.np";

function escapeJson(value) {
  return JSON.stringify(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function laneIndexHtml(locale) {
  const node = laneIndexItemListNode(locale.id);
  const links = laneSlugs.map((slug) => `<a href="${locale.prefix}/lanes/${slug}">${laneFor(locale.id, slug).title}</a>`).join("");
  return `<html><head><title>${node.name}</title></head><body>${links}<script type="application/ld+json">${escapeJson({ "@graph": [node] })}</script></body></html>`;
}

test("a healthy lane index passes, and losing a lane or the ItemList fails", () => {
  for (const locale of locales) {
    assert.deepEqual(laneIndexProblems({ html: laneIndexHtml(locale), prefix: locale.prefix, origin }), [], locale.id);
  }
  const missingLink = laneIndexHtml(locales[0]).replace(`<a href="/lanes/${laneSlugs[0]}"`, "<a href=\"/lanes/x\"");
  assert.ok(laneIndexProblems({ html: missingLink, prefix: "", origin }).some((problem) => problem.includes("omits")));
  const noList = laneIndexHtml(locales[0]).replace(/<script[\s\S]*<\/script>/, "");
  assert.deepEqual(laneIndexProblems({ html: noList, prefix: "", origin }), ["no ItemList JSON-LD"]);
});

test("JSON-LD is read through the HTML entities a script tag carries", () => {
  const html = `<script type="application/ld+json">${escapeJson({ "@type": "ItemList", numberOfItems: 0, itemListElement: [] })}</script>`;
  const nodes = jsonLdNodes(html);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]["@type"], "ItemList");
});

test("lane links are read per locale", () => {
  assert.deepEqual(laneHrefs(laneIndexHtml(locales[1]), "/ne").sort(), laneSlugs.map((slug) => `/ne/lanes/${slug}`).sort());
  assert.deepEqual(laneHrefs(`<a href="/lanes/${laneSlugs[0]}">x</a>`, "").length, 1);
});

test("a lane page is checked for Service, FAQ, canonical and title", () => {
  const slug = laneSlugs[0];
  const lane = laneFor("en", slug);
  const nodes = [
    { "@type": "Service", "@id": `${origin}/lanes/${slug}#service`, name: lane.title, areaServed: [{ "@type": "City", name: lane.origin }, { "@type": "City", name: lane.destination }, { "@type": "Country", name: "Nepal" }], provider: { "@id": `${origin}/#organization` } },
    { "@type": "FAQPage", mainEntity: lane.questions.map((item) => ({ "@type": "Question", name: item.question })) },
  ];
  const html = `<html><head><title>${lane.title}</title><link rel="canonical" href="${origin}/lanes/${slug}"></head><body><script type="application/ld+json">${escapeJson({ "@graph": nodes })}</script></body></html>`;
  assert.deepEqual(lanePageProblems({ html, slug, origin }), []);
  const shallowNodes = [
    { ...nodes[0], areaServed: nodes[0].areaServed.slice(0, 2) },
    nodes[1],
  ];
  const shallow = `<html><head><title>${lane.title}</title><link rel="canonical" href="${origin}/lanes/${slug}"></head><body><script type="application/ld+json">${escapeJson({ "@graph": shallowNodes })}</script></body></html>`;
  assert.ok(lanePageProblems({ html: shallow, slug, origin }).some((problem) => problem.includes("areaServed")));
  assert.ok(lanePageProblems({ html: html.replace(`${origin}/lanes/${slug}`, `${origin}/lanes/other`), slug, origin }).some((problem) => problem.includes("canonical")));
});

test("the quote page must still carry its form", () => {
  assert.deepEqual(quotePageProblems(`<form class="quote-card"><input name="mode"/></form>`), []);
  assert.ok(quotePageProblems("<div>maintenance</div>").includes("no quote form"));
});

test("the sitemap must list every lane index and lane page, or the check fails", () => {
  const urls = locales.flatMap((locale) => [`${origin}${locale.prefix}/lanes`, ...laneSlugs.map((slug) => `${origin}${locale.prefix}/lanes/${slug}`)]);
  const xml = `<?xml version="1.0"?><urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
  assert.deepEqual(sitemapProblems({ xml, origin }), []);
  const missing = sitemapProblems({ xml: xml.replace(`<loc>${origin}/ne/lanes/${laneSlugs[1]}</loc>`, ""), origin });
  assert.deepEqual(missing, [`sitemap is missing ${origin}/ne/lanes/${laneSlugs[1]}`]);
});

test("a blog note must link a real lane, or the check fails", () => {
  const good = `<ul class="link-list"><li><a href="/lanes/kolkata-to-birgunj">Kolkata to Birgunj transport</a></li></ul>`;
  assert.deepEqual(blogPostProblems({ html: good, slug: "note" }), []);
  assert.ok(blogPostProblems({ html: `<ul class="link-list"><li><a href="/guides/x">x</a></li></ul>`, slug: "note" }).includes("note links no lane"));
  assert.ok(blogPostProblems({ html: `<ul class="link-list"><a href="/lanes/not-a-lane">x</a></ul>`, slug: "note" }).some((problem) => problem.includes("no known lane")));
});

test("the private surfaces must stay private", () => {
  assert.deepEqual(adminGuardProblems({ trackerStatus: 401, trackerBody: '{"ok":false,"error":"Sign in is required."}', enquiriesHtml: "<p>Loading workspace…</p>" }), []);
  assert.ok(adminGuardProblems({ trackerStatus: 200, trackerBody: "csv", enquiriesHtml: "" }).length === 2);
  assert.ok(adminGuardProblems({ trackerStatus: 401, trackerBody: "Sign in is required.", enquiriesHtml: '<div class="enq-row">' }).some((problem) => problem.includes("record markup")));
});
