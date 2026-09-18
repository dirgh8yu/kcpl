import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// `npm run audit:dead-css` decides that a rule can never apply, then reports how
// much of the admin stylesheets is in that state. It is deliberately
// conservative: a class only counts as live if it appears in some string under
// app/, in a `className` template pattern, or in a rendered-token snapshot, so a
// rule is only called dead when no path can put that class in the DOM.
//
// This gate pins the *ceiling*, not the exact number. The baseline is what
// remains after the 2026-09 consolidation pass, most of it in one contiguous
// retired block that is too large for the editing path used there; deleting
// more is fine, adding new unreachable rules is not.

const MAX_DEAD_RULES = 275;
const MAX_DEAD_LINES = 1224;

const runAudit = () => {
  const output = execFileSync("node", ["scripts/dead-css-audit.mjs", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output);
};

test("admin stylesheets do not grow unreachable rules", () => {
  const report = runAudit();

  assert.ok(report.totals.rules > 0, "the audit parsed no rules at all");

  for (const sheet of report.sheets) {
    assert.ok(
      sheet.rules > 0,
      `${sheet.sheet}: no rules parsed — the audit or the sheet moved`,
    );
  }

  assert.ok(
    report.totals.dead <= MAX_DEAD_RULES,
    `unreachable rules grew: ${report.totals.dead} > ${MAX_DEAD_RULES}. ` +
      `Run \`npm run audit:dead-css -- --list\` and either delete the rules or ` +
      `explain them in plans/admin-css-consolidation.md.`,
  );

  assert.ok(
    report.totals.lines <= MAX_DEAD_LINES,
    `unreachable CSS lines grew: ${report.totals.lines} > ${MAX_DEAD_LINES}`,
  );
});

test("the audit can still tell a dead class from a live one", () => {
  // A silent change in how class names are harvested would report the whole
  // sheet as dead, which is the one failure that could justify a bad deletion.
  // `kcpl-admin-content` and `ops-field` are rendered by operations-shell and
  // operations-ui, so they must never appear in an unreachable token list.
  const report = runAudit();
  const unreachable = new Set(
    report.sheets.flatMap((sheet) => sheet.dead.flatMap((rule) => rule.unreachable)),
  );
  for (const liveClass of ["kcpl-admin-content", "ops-field", "ops-metric", "app-nav-search"]) {
    assert.ok(
      !unreachable.has(liveClass),
      `"${liveClass}" is rendered but the audit called it unreachable`,
    );
  }
});
