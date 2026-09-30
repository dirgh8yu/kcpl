import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repo = (path) => new URL(`../${path}`, import.meta.url);

test("a focus ring appears at once: it answers a key press", async () => {
  const system = await readFile(repo("app/admin/operations-system.css"), "utf8");
  // Hover colours may fade; the ring that shows where the keyboard is may not.
  assert.match(system, /\.kcpl-admin-route :focus-visible \{ transition-duration: 0s; \}/);
});

test("the Shipments screen uses the app's focus ring, not a faint halo", async () => {
  const shipments = await readFile(repo("app/admin/shipments/shipments-premium.css"), "utf8");
  // An 18% crimson halo is about 1.3:1 on white; focus has to reach 3:1.
  assert.match(shipments, /--ship-focus: 0 0 0 2px var\(--app-focus\);/);
  assert.doesNotMatch(shipments, /--ship-focus:[^;]*color-mix/);
  // The selected view wears a shadow, so its ring is an outline in the later sheet.
  assert.match(shipments, /\.shipments-view-toggle button:focus-visible \{ outline: 2px solid var\(--app-focus\);/);
});
