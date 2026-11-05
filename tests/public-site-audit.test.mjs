import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import nextConfig from "../next.config.ts";

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
  for (const selector of [".quote-concierge-grid input", ".track-link-entry input", ".site-search-form input"]) {
    const sizes = declarations(selector).filter((decl) => decl.prop === "font-size");
    assert.ok(sizes.length, selector);
    for (const { value } of sizes) assert.equal(value, "16px", selector);
  }
});

test("the page ends above the phone action bar", () => {
  const footer = declarations(".site-footer");
  assert.ok(footer.some(({ prop, media }) => prop === "padding-bottom" && /max-width: 760px/.test(media ?? "")));
  // A base `padding` comes later in the file and would cancel the phone rule.
  assert.deepEqual(footer.filter(({ prop, media }) => /^padding/.test(prop) && !media), []);
});

test("the phone quote button keeps white text on crimson", () => {
  // The bar only shows on phones, so any base colour here overrides its white text.
  assert.deepEqual(declarations(".site-action").filter(({ prop, media }) => prop === "color" && !media), []);
  assert.ok(declarations(".site-action-primary").some(({ prop, value }) => prop === "color" && value === "#fff"));
});

test("the phone map card is anchored to one edge, so it cannot stretch", () => {
  const card = declarations(".network-map-selection");
  const phone = card.filter(({ media }) => /max-width: 760px/.test(media ?? ""));
  assert.ok(phone.some(({ prop, value }) => prop === "bottom" && value === "auto"));
  assert.ok(phone.some(({ prop }) => prop === "top"));
  assert.deepEqual(card.filter(({ prop, media }) => prop === "top" && !/max-width: 760px/.test(media ?? "")), []);
});

test("the logo keeps its width and the phone header drops the rotating word", () => {
  assert.ok(declarations(".site-lockup").some(({ prop, value }) => prop === "flex-shrink" && value === "0"));
  assert.ok(declarations(".site-lang-rotator").some(({ prop, value, media }) => prop === "display" && value === "none" && /max-width: 430px/.test(media ?? "")));
  // The panel must open inward now the trigger sits at the screen's right edge.
  assert.ok(declarations(".site-lang-panel").some(({ prop, media }) => prop === "inset-inline" && /max-width: 430px/.test(media ?? "")));
});

test("the 404 page has a title and a visible way back", async () => {
  for (const path of ["app/not-found.tsx", "app/(en)/not-found.tsx"]) {
    assert.match(await readFile(repo(path), "utf8"), /export const metadata: Metadata = \{ title: "Page not found/, path);
  }
  const page = await readFile(repo("app/components/not-found-page.tsx"), "utf8");
  assert.match(page, /<Link href="\/" className="button-primary">Return home<\/Link>/);
  // A bare .section-link is near-black, on this page's near-black heading band.
  assert.ok(declarations(".not-found-actions .section-link").some(({ prop, value }) => prop === "color" && value === "#fff"));
});
