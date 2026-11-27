import assert from "node:assert/strict";
import test from "node:test";
import {
  adminGuardProblems,
  blogPostProblems,
  guidePageProblems,
  jsonLdNodes,
  laneHrefs,
  laneIndexProblems,
  laneNotFoundProblems,
  laneNoteProblems,
  lanePageProblems,
  laneSlugs,
  locales,
  quotePageProblems,
  robotsProblems,
  sitemapProblems,
  toolPageProblems,
  toolSlugs,
  trackPageProblems,
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

/* The five blind spots this pass closed. Each one is tested in both directions:
 * the healthy page passes, and the deliberately broken page fails, so a green
 * smoke run means the checks ran rather than that they never looked. */

function toolHtml({ url, apps = 1, trails = 1, endAt = url, canonical = url }) {
  const nodes = [];
  for (let index = 0; index < apps; index += 1) {
    nodes.push({
      "@type": "WebApplication",
      "@id": `${url}#app`,
      url,
      name: "Duty estimate",
      operatingSystem: "Web",
      provider: { "@id": `${origin}/#organization` },
    });
  }
  for (let index = 0; index < trails; index += 1) {
    nodes.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Tools", item: `${origin}/tools` },
        { "@type": "ListItem", position: 3, name: "Duty", item: endAt },
      ],
    });
  }
  return `<html><head><link rel="canonical" href="${canonical}"></head><body><script type="application/ld+json">${escapeJson({ "@graph": nodes })}</script></body></html>`;
}

test("a calculator page needs exactly one WebApplication and one breadcrumb", () => {
  const url = `${origin}/tools/duty-estimate`;
  assert.deepEqual(toolPageProblems({ html: toolHtml({ url }), slug: "duty-estimate", origin }), []);
  for (const slug of toolSlugs) {
    assert.deepEqual(toolPageProblems({ html: toolHtml({ url: `${origin}/tools/${slug}` }), slug, origin }), [], slug);
  }
  const none = toolPageProblems({ html: toolHtml({ url, apps: 0 }), slug: "duty-estimate", origin });
  assert.ok(none.some((problem) => problem.includes("0 WebApplication nodes")), none.join("; "));
  const twice = toolPageProblems({ html: toolHtml({ url, apps: 2 }), slug: "duty-estimate", origin });
  assert.ok(twice.some((problem) => problem.includes("2 WebApplication nodes")), twice.join("; "));
  const noTrail = toolPageProblems({ html: toolHtml({ url, trails: 0 }), slug: "duty-estimate", origin });
  assert.ok(noTrail.some((problem) => problem.includes("0 BreadcrumbList nodes")), noTrail.join("; "));
  const twoTrails = toolPageProblems({ html: toolHtml({ url, trails: 2 }), slug: "duty-estimate", origin });
  assert.ok(twoTrails.some((problem) => problem.includes("2 BreadcrumbList nodes")), twoTrails.join("; "));
  const wrongEnd = toolPageProblems({ html: toolHtml({ url, endAt: `${origin}/tools/storage-charges` }), slug: "duty-estimate", origin });
  assert.ok(wrongEnd.some((problem) => problem.includes("breadcrumb ends at")), wrongEnd.join("; "));
  const wrongCanonical = toolPageProblems({ html: toolHtml({ url, canonical: `${origin}/tools/other` }), slug: "duty-estimate", origin });
  assert.ok(wrongCanonical.some((problem) => problem.includes("canonical is not")), wrongCanonical.join("; "));
  const localised = toolPageProblems({ html: toolHtml({ url: `${origin}/ne/tools/duty-estimate` }), prefix: "/ne", slug: "duty-estimate", origin });
  assert.deepEqual(localised, []);
});

function guideHtml({ slug, canonical = `${origin}/guides/${slug}`, faq = true, answers = true }) {
  const nodes = faq
    ? [{ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Do I pay duty?", acceptedAnswer: answers ? { "@type": "Answer", text: "Duty depends on the HS code." } : { "@type": "Answer", text: "" } }] }]
    : [];
  return `<html><head><link rel="canonical" href="${canonical}"></head><body><script type="application/ld+json">${escapeJson({ "@graph": nodes })}</script></body></html>`;
}

test("a guide page must keep its FAQ schema, or the check fails", () => {
  const slug = "importing-to-nepal";
  assert.deepEqual(guidePageProblems({ html: guideHtml({ slug }), slug, origin }), []);
  const noFaq = guidePageProblems({ html: guideHtml({ slug, faq: false }), slug, origin });
  assert.ok(noFaq.some((problem) => problem.includes("0 FAQPage nodes")), noFaq.join("; "));
  const noAnswer = guidePageProblems({ html: guideHtml({ slug, answers: false }), slug, origin });
  assert.ok(noAnswer.some((problem) => problem.includes("has no answer")), noAnswer.join("; "));
  const wrongCanonical = guidePageProblems({ html: guideHtml({ slug, canonical: `${origin}/guides/x` }), slug, origin });
  assert.ok(wrongCanonical.some((problem) => problem.includes("canonical is not")), wrongCanonical.join("; "));
});

test("the tracker page must keep its entry box, or the check fails", () => {
  const good = `<div class="track-box"><form class="box-form"><input/></form><a href="/portal">portal</a></div>`;
  assert.deepEqual(trackPageProblems(good), []);
  assert.ok(trackPageProblems("<div>maintenance</div>").includes("no tracking entry box"));
  assert.ok(trackPageProblems(`<div class="track-box"><p>down</p></div>`).includes("no tracking form"));
  assert.ok(trackPageProblems(`<div class="track-box"><form class="box-form"></form></div>`).includes("no customer-portal handoff"));
});

test("robots.txt must name the sitemap and keep the API out, or the check fails", () => {
  const body = "User-Agent: *\nAllow: /\nAllow: /api/gallery/\nDisallow: /api/\n\nSitemap: https://kapileshworcargo.com.np/sitemap.xml\n";
  assert.deepEqual(robotsProblems({ status: 200, body, origin }), []);
  assert.ok(robotsProblems({ status: 503, body, origin }).includes("/robots.txt answered 503"));
  assert.ok(robotsProblems({ status: 200, body: body.replace(/Sitemap:.*\n/, ""), origin }).some((problem) => problem.includes("no sitemap line")));
  assert.ok(robotsProblems({ status: 200, body: body.replace("Disallow: /api/", "Disallow: /"), origin }).includes("robots.txt disallows the whole site"));
});

test("an unknown corridor must be a 404, not a page with lane schema", () => {
  const slug = "no-such-corridor";
  assert.deepEqual(laneNotFoundProblems({ status: 404, html: "<html><body>Not found</body></html>", slug }), []);
  const soft = laneNotFoundProblems({ status: 200, html: "<html></html>", slug });
  assert.ok(soft.some((problem) => problem.includes("expected 404")), soft.join("; "));
  const schema = `<script type="application/ld+json">${escapeJson({ "@graph": [{ "@type": "Service", "@id": `${origin}/lanes/${slug}#service` }] })}</script>`;
  assert.ok(laneNotFoundProblems({ status: 200, html: schema, slug }).includes("the response still publishes lane Service schema"));
});

test("a lane page must link the notes that link it, or the check fails", () => {
  const slug = "kolkata-to-birgunj";
  const note = "container-at-birgunj-what-happens-next";
  const good = `<ul class="link-list"><li><a href="/blog/${note}">Birgunj</a></li></ul>`;
  assert.deepEqual(laneNoteProblems({ html: good, slug, notes: [note] }), []);
  assert.ok(laneNoteProblems({ html: "<p>no links</p>", slug, notes: [note] }).includes(`${slug} links no blog note`));
  assert.ok(laneNoteProblems({ html: `<a href="/blog/another-note">x</a>`, slug, notes: [note] }).includes(`${slug} omits its note ${note}`));
});

test("the private surfaces must stay private", () => {
  assert.deepEqual(adminGuardProblems({ trackerStatus: 401, trackerBody: '{"ok":false,"error":"Sign in is required."}', enquiriesHtml: "<p>Loading workspace…</p>" }), []);
  assert.ok(adminGuardProblems({ trackerStatus: 200, trackerBody: "csv", enquiriesHtml: "" }).length === 2);
  assert.ok(adminGuardProblems({ trackerStatus: 401, trackerBody: "Sign in is required.", enquiriesHtml: '<div class="enq-row">' }).some((problem) => problem.includes("record markup")));
});
