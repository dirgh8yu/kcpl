import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const postcss = require("postcss");
const repo = (path) => new URL(`../${path}`, import.meta.url);

async function cssFiles(dir) {
  const out = [];
  for (const entry of await readdir(repo(dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await cssFiles(path));
    else if (entry.name.endsWith(".css")) out.push(path);
  }
  return out;
}

// On a phone the first tap applies :hover and it stays until the next tap
// somewhere else, so a tapped chip or button looks stuck. Hover styles in the
// staff workspace and the portal apply only to a mouse or trackpad.
test("staff and portal hover styles never stick on a touch screen", async () => {
  const ungated = [];
  for (const path of [...await cssFiles("app/admin"), ...await cssFiles("app/portal")]) {
    // The Overview's drag handles use desktop drag and drop, which touch does not have.
    if (path === "app/admin/arrangeable-grid.css") continue;
    postcss.parse(await readFile(repo(path), "utf8")).walkRules((rule) => {
      if (!rule.selector.includes(":hover")) return;
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === "atrule" && /hover:\s*hover/.test(parent.params)) return;
      }
      ungated.push(`${path}:${rule.source.start.line} ${rule.selector}`);
    });
  }
  assert.deepEqual(ungated, [], "wrap these in @media (hover: hover) and (pointer: fine)");
});

test("touch screens get 16px fields, bigger ticks and instant taps", async () => {
  const css = await readFile(repo("app/admin/operations-system.css"), "utf8");
  const touch = css.slice(css.indexOf("@media (pointer: coarse) {"));
  assert.ok(touch.length > 30, "a (pointer: coarse) block exists");
  // iOS zooms into any field under 16px and never zooms back out.
  assert.match(touch, /select, textarea\) \{ font-size: 16px; \}/);
  assert.match(touch, /input\[type="checkbox"\], input\[type="radio"\]\) \{ width: 24px; height: 24px; \}/);
  assert.match(touch, /touch-action: manipulation;/);
  assert.match(touch, /user-select: none;/);
});

test("zoom is never disabled, and only the product gets the product chrome", async () => {
  assert.doesNotMatch(await readFile(repo("app/site-document.tsx"), "utf8"), /maximumScale|userScalable/);
  const doc = await readFile(repo("app/product-viewport.ts"), "utf8");
  assert.doesNotMatch(doc, /maximumScale|userScalable/);
  assert.match(doc, /export const productViewport: Viewport = \{\s*\.\.\.baseViewport,\s*themeColor: "#ffffff",\s*colorScheme: "light",\s*interactiveWidget: "resizes-content",/);
  for (const layout of ["app/admin/layout.tsx", "app/portal/layout.tsx"]) {
    assert.match(await readFile(repo(layout), "utf8"), /export const viewport = productViewport;/, layout);
  }
  // The installed portal's status bar matches its white top bar.
  const manifest = JSON.parse(await readFile(repo("public/portal.webmanifest"), "utf8"));
  assert.equal(manifest.theme_color.toLowerCase(), "#ffffff");
});
