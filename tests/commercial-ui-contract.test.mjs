import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Flexible commercial navigation contract. Commercial destinations must stay
// reachable through the single canonical registry — not a duplicated hardcoded
// navigation list inside the shell.

const navigationPath = new URL("../app/admin/workflow-navigation.ts", import.meta.url);
const shellPath = new URL("../app/admin/operations-shell.tsx", import.meta.url);

const commercialRoutes = [
  "/admin/enquiries",
  "/admin/crm",
  "/admin/rating",
  "/admin/pricing",
  "/admin/consolidation",
  "/admin/tenders",
  "/admin/market-estimate",
];

test("commercial destinations live in the canonical workspace registry", async () => {
  const navigation = await readFile(navigationPath, "utf8");
  for (const href of commercialRoutes) {
    assert.ok(navigation.includes(`href: "${href}"`), `missing commercial route ${href}`);
  }
  assert.match(navigation, /group: "Plan & Sell"/);
});

test("shell does not re-hardcode a parallel commercial navigation list", async () => {
  const shell = await readFile(shellPath, "utf8");
  assert.doesNotMatch(shell, /const commercialWorkflow = \[/);
  assert.match(shell, /groupedWorkspaces\(capabilities\)/);
});
