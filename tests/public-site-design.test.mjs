import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { routeMap } from "../app/route-map-data.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the opening route map has land, a lit Nepal and every stop inside the picture", () => {
  assert.ok(routeMap.land.length > 1000, "the dotted land is missing");
  assert.ok(routeMap.nepal.length > 50, "Nepal's dots are missing");
  for (const [place, [x, y]] of Object.entries(routeMap.places)) {
    assert.ok(x >= 0 && x <= routeMap.width && y >= 0 && y <= routeMap.height, `${place} falls outside the map`);
  }
  for (const [leg, d] of Object.entries(routeMap.routes)) assert.match(d, /^M[\d.]+ [\d.]+C/, `${leg} is not a drawable curve`);
  // Kathmandu is the destination: it sits north of Birgunj, which sits north of Kolkata.
  assert.ok(routeMap.places.kathmandu[1] < routeMap.places.birgunj[1] && routeMap.places.birgunj[1] < routeMap.places.kolkata[1]);
});

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

test("headlines are set in the display face, and the header carries the guides", () => {
  const css = read("app/site.css");
  assert.match(css, /--font-display: var\(--font-instrument\)/);
  assert.match(css, /\.site-root \.hero-title, \.site-root \.section-title/);
  const chrome = read("app/components/site-chrome.tsx");
  assert.match(chrome, /const headerNavigation = \[[\s\S]*?\{ path: "\/guides" \}/);
});
