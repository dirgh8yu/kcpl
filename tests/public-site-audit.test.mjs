import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import nextConfig from "../next.config.ts";
import { guideIndex, guides } from "../app/guide-data.ts";
import { siteText } from "../app/site-i18n.ts";
import { tools } from "../app/tool-data.ts";


const require = createRequire(import.meta.url);
const postcss = require("postcss");
const repo = (path) => new URL(`../${path}`, import.meta.url);
const site = postcss.parse(await readFile(repo("app/site.css"), "utf8"));

// The declarations for one exact selector, outside and inside any media query.
function declarations(selector) {
  const found = [];
  site.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const media = rule.parent.type === "atrule" ? rule.parent.params : null;
    rule.walkDecls((decl) => found.push({ prop: decl.prop, value: decl.value, media }));
  });
  return found;
}

test("App Hosting runs the image optimiser, which it disables unless told otherwise", () => {
  assert.equal(nextConfig.images.unoptimized, false);
  assert.ok(nextConfig.images.minimumCacheTTL >= 86400, "a short TTL sends visitors to a cold encode");
});

test("every response carries the security headers", async () => {
  const rules = await nextConfig.headers();
  const all = rules.find((rule) => rule.source === "/:path*");
  assert.ok(all, "a rule covers every path");
  const headers = Object.fromEntries(all.headers.map(({ key, value }) => [key, value]));
  assert.match(headers["Strict-Transport-Security"], /max-age=31536000/);
  assert.equal(headers["X-Frame-Options"], "SAMEORIGIN");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.ok(headers["Referrer-Policy"]);
  assert.ok(headers["Permissions-Policy"]);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'self'/);
  // Scripts stay report-only until the live console shows the policy is clean.
  assert.doesNotMatch(headers["Content-Security-Policy"], /script-src|default-src/);
  assert.match(headers["Content-Security-Policy-Report-Only"], /default-src 'self'/);
  for (const path of ["/admin/:path*", "/portal/:path*"]) {
    assert.ok(rules.some((rule) => rule.source === path && rule.headers.some(({ key }) => key === "X-Robots-Tag")), path);
  }
});

test("public text stays at 12px or more, apart from the logo wordmark", () => {
  const small = [];
  site.walkDecls("font-size", (decl) => {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(decl.value);
    if (!px || Number(px[1]) >= 12 || decl.parent.selector?.includes(".site-lockup")) return;
    small.push(`${decl.source.start.line} ${decl.parent.selector}: ${decl.value}`);
  });
  assert.deepEqual(small, []);
});

test("public fields are 16px, because iOS zooms into anything smaller", () => {
  // The shared field rule sets the font shorthand; nothing may set a smaller size.
  for (const selector of [".field input", ".route-end input", ".box-form input"]) {
    assert.ok(declarations(selector).some(({ prop, value }) => prop === "font" && /\b16px\//.test(value)), selector);
  }
  site.walkRules((rule) => {
    if (!/(^|\s)input(\s|,|:|$)/.test(rule.selector)) return;
    rule.walkDecls("font-size", (decl) => assert.ok(parseFloat(decl.value) >= 16, `${rule.selector}: ${decl.value}`));
  });
});

test("the page ends above the phone action bar", () => {
  const padded = declarations(".site-root").filter(({ prop, media }) => prop === "padding-bottom" && /max-width: 900px/.test(media ?? ""));
  assert.ok(padded.length);
  assert.ok(declarations(".site-action-bar").some(({ prop, value, media }) => prop === "position" && value === "fixed" && /max-width: 900px/.test(media ?? "")));
});

test("the phone quote button keeps white text on crimson", () => {
  const primary = declarations(".site-action-primary");
  assert.ok(primary.some(({ prop, value }) => prop === "color" && value === "#fff"));
  assert.ok(primary.some(({ prop, value }) => prop === "background" && value === "var(--crimson)"));
});

test("the map card is anchored to one corner, so it cannot stretch", () => {
  const card = declarations(".network-map-selection");
  assert.ok(card.some(({ prop }) => prop === "bottom"));
  assert.deepEqual(card.filter(({ prop }) => prop === "top" || prop === "right"), []);
});

test("the logo keeps its width on every screen", () => {
  assert.ok(declarations(".site-lockup").some(({ prop, value }) => prop === "flex-shrink" && value === "0"));
});

test("hover styles only apply where hovering exists, and every moving thing can stop", () => {
  const ungated = [];
  site.walkRules((rule) => {
    if (!rule.selector.includes(":hover")) return;
    if (rule.parent.type === "atrule" && /hover:\s*hover/.test(rule.parent.params)) return;
    ungated.push(rule.selector);
  });
  assert.deepEqual(ungated, []);
  const reduced = [];
  site.walkAtRules("media", (media) => { if (/prefers-reduced-motion: reduce/.test(media.params)) media.walkRules((rule) => reduced.push(rule.selector)); });
  for (const selector of [".rail-track", ".route-draw, .route-map[data-mode=\"air\"] .route-air"]) assert.ok(reduced.includes(selector), selector);
});

test("no public page ships a photograph without a recorded source", async () => {
  const sources = await readFile(repo("docs/public-photo-sources.md"), "utf8");
  const code = await Promise.all(["home-page", "interior-pages", "showcase-pages", "services-page", "freight-guide-page", "network-page", "quote-concierge"].map((name) => readFile(repo(`app/components/${name}.tsx`), "utf8")));
  const used = new Set(code.join("\n").match(/\/images\/unsplash\/[\w-]+\.jpg/g));
  assert.ok(used.size);
  for (const path of used) assert.ok(sources.includes(path.slice(1)), path);
  // These carry other companies' branding, which the owner ruled out.
  for (const path of ["ship-dusk", "port-crane", "air-cargo", "forklift-loading"]) assert.ok(![...used].some((entry) => entry.includes(path)), path);
});

test("staged reveal never hides content on its own, and the line and the reveal agree", async () => {
  // Hidden states exist only under classes the client adds, so without JavaScript nothing is hidden.
  site.walkDecls("opacity", (decl) => {
    if (decl.value !== "0" || !/reveal/.test(decl.parent.selector)) return;
    assert.match(decl.parent.selector, /\.reveal-wait/, decl.parent.selector);
  });
  const reveal = await readFile(repo("app/components/route-reveal.tsx"), "utf8");
  assert.doesNotMatch(reveal, /addEventListener\("scroll"/, "the spine is CSS; no scroll listeners");
  assert.match(reveal, /LINE_AT = 0\.72/);
  assert.ok(declarations(".spine i").some(({ prop, value }) => prop === "animation-range" && value.includes("28svh") && value.includes("72svh")), "the spine's front must sit where the reveal fires");
  for (const required of ["focusin", ".site-footer", "getBoundingClientRect().top < window.innerHeight"]) assert.ok(reveal.includes(required), required);
});

test("long answers open on a tap and stay in the page", async () => {
  const parts = await readFile(repo("app/components/route-parts.tsx"), "utf8");
  assert.match(parts, /<details key=/);
  for (const path of ["services-page", "freight-guide-page", "interior-pages"]) {
    const code = await readFile(repo(`app/components/${path}.tsx`), "utf8");
    assert.match(code, /<QaList/, path);
    assert.doesNotMatch(code, /<dl className="qa"/, path);
  }
});

test("forms and legal pages stay still", async () => {
  const pages = await readFile(repo("app/components/interior-pages.tsx"), "utf8");
  for (const name of ["ContactPage", "TrackPage", "CareersPage"]) {
    const body = pages.slice(pages.indexOf(`export function ${name}`));
    assert.match(body.slice(0, body.indexOf("</SiteShell>")), /<Lined>/, name);
  }
  assert.doesNotMatch(await readFile(repo("app/components/tool-pages.tsx"), "utf8"), /<Lined reveal>/);
});

test("the network map shows at once, and the photo is only a stand-in for a map that failed", async () => {
  const map = await readFile(repo("app/components/network-map.tsx"), "utf8");
  assert.match(map, /\{mapUnavailable \? <Image src="\/images\/nepal-satellite/, "the photo must not render while the map loads");
  assert.doesNotMatch(map, /on\("idle"/, "nothing waits for the last tile");
  // Visitors read a hidden canvas over a full-strength photo as the map itself.
  assert.deepEqual(declarations(".network-map-canvas").filter(({ prop }) => prop === "opacity"), []);
  assert.ok(declarations(".network-map-fallback-image").some(({ prop, value }) => prop === "opacity" && Number(value) < 1));
});

test("noindex on the App Hosting address can never reach the real site", async () => {
  const headers = await nextConfig.headers();
  const noindex = headers.filter((rule) => rule.headers.some(({ key, value }) => key === "X-Robots-Tag" && value.includes("noindex")));
  const siteWide = noindex.filter((rule) => rule.source === "/:path*");
  assert.equal(siteWide.length, 1);
  const host = siteWide[0].has?.find((item) => item.type === "host")?.value;
  assert.ok(host, "a site-wide noindex must be limited to one host");
  const matches = (name) => new RegExp(`^${host}$`).test(name);
  assert.ok(matches("kcpl--kcpl-82574.asia-southeast1.hosted.app"));
  for (const name of ["kapileshworcargo.com.np", "www.kapileshworcargo.com.np", "localhost"]) assert.equal(matches(name), false, name);
});

test("service pages link on to guides and tools", async () => {
  const code = await readFile(repo("app/components/services-page.tsx"), "utf8");
  assert.match(code, /Record<ServiceSlug, \{ guides: GuideSlug\[\]; tool: ToolSlug \}>/);
  assert.match(code, /`\/guides\/\$\{guide\}`/);
  assert.match(code, /`\/tools\/\$\{serviceResources\[slug\]\.tool\}`/);
});

test("the quote page stays static, and published gallery photographs are resized", async () => {
  for (const path of ["(en)", "ne", "hi", "zh"]) {
    assert.doesNotMatch(await readFile(repo(`app/${path}/quote/page.tsx`), "utf8"), /searchParams/, path);
  }
  assert.match(await readFile(repo("app/components/quote-concierge.tsx"), "utf8"), /window\.location\.search/);
  assert.doesNotMatch(await readFile(repo("app/components/showcase-pages.tsx"), "utf8"), /unoptimized/);
});

test("the 404 page has a title and a visible way back", async () => {
  for (const path of ["app/not-found.tsx", "app/(en)/not-found.tsx"]) {
    assert.match(await readFile(repo(path), "utf8"), /export const metadata: Metadata = \{ title: "Page not found/, path);
  }
  const page = await readFile(repo("app/components/not-found-page.tsx"), "utf8");
  assert.match(page, /<Link href="\/" className="btn">Return home<\/Link>/);
});

test("phase-one English metadata descriptions stay within 140–155 Unicode characters", () => {
  const descriptions = new Map([
    ["/", siteText("en", "home.meta_description")],
    ["/guides", guideIndex.en.description],
    ["/guides/importing-to-nepal", guides.en["importing-to-nepal"].description],
    ["/guides/exporting-from-nepal", guides.en["exporting-from-nepal"].description],
    ["/work", siteText("en", "work.meta_description")],
    ["/tools", tools.en.index.description],
    ["/services", siteText("en", "services.meta_description")],
    ["/guides/sea-freight-through-india", guides.en["sea-freight-through-india"].description],
    ["/services/delivery", siteText("en", "svc.delivery.summary")],
    ["/careers", siteText("en", "careers.meta_description")],
  ]);

  for (const [path, description] of descriptions) {
    const count = [...description].length;
    assert.ok(count >= 140 && count <= 155, `${path} description has ${count} Unicode characters`);
  }
});
