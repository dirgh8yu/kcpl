import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every photograph the site imports exists in the graded set and stays light", () => {
  const source = read("app/site-photos.ts");
  const files = [...source.matchAll(/from "\.\.\/public\/images\/site\/([a-z-]+\.jpg)"/g)].map((match) => match[1]);
  assert.ok(files.length >= 10, "site-photos.ts imports fewer photographs than expected");
  for (const file of files) {
    const path = new URL(`../public/images/site/${file}`, import.meta.url);
    assert.ok(existsSync(path), `${file} is imported but was never graded`);
    assert.ok(statSync(path).size < 800 * 1024, `${file} is heavier than 800KB`);
  }
  const graded = readdirSync(new URL("../public/images/site/", import.meta.url));
  for (const file of graded) assert.ok(files.includes(file), `${file} is graded but nothing imports it`);
});

test("photographs with another company's name on them do not come back", () => {
  const pages = ["app/components/home-page.tsx", "app/components/services-page.tsx", "app/components/interior-pages.tsx", "app/components/showcase-pages.tsx", "app/site-photos.ts"];
  for (const page of pages) assert.doesNotMatch(read(page), /ship-dusk|port-crane|air-cargo|forklift-loading/, `${page} uses a retired photograph`);
});

test("headlines are set in the one sans-serif, and the header carries the guides", () => {
  const css = read("app/site.css");
  const block = css.slice(css.indexOf("The public site, October 2026"));
  assert.ok(block.length > 1000, "the October 2026 block is missing from site.css");
  assert.match(block, /--font-sans: -apple-system/);
  assert.match(block, /\.site-root :is\(\.hero-title, \.section-title[^)]*\) \{\s*font-family: inherit;/);
  assert.doesNotMatch(block, /--font-instrument|font-style: italic/, "a serif display face came back");
  const chrome = read("app/components/site-chrome.tsx");
  assert.match(chrome, /const headerNavigation = \[[\s\S]*?\{ path: "\/guides" \}/);
});

test("every language has its own share card, small enough for WhatsApp", () => {
  for (const locale of ["en", "ne", "hi", "zh"]) {
    const path = new URL(`../public/og/${locale}.jpg`, import.meta.url);
    assert.ok(existsSync(path), `public/og/${locale}.jpg is missing: run node scripts/build-share-images.mjs`);
    assert.ok(statSync(path).size < 150 * 1024, `public/og/${locale}.jpg is heavier than 150KB`);
  }
  assert.match(read("app/seo.ts"), /\/og\/\$\{locale\}\.jpg/);
  for (const retired of ["og.jpg", "og.png", "og-cinematic.jpg"]) assert.ok(!existsSync(new URL(`../public/${retired}`, import.meta.url)), `public/${retired} came back`);
});
