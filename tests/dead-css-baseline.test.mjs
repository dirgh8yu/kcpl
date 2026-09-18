import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// `npm run audit:dead-css` decides that a rule can never apply, then reports how
// much of the admin stylesheets is in that state. It is deliberately
// conservative: a class only counts as live if it appears in some string under
// app/, in a `className` template pattern, or in a rendered-token snapshot, so a
// rule is only called dead when no path can put that class in the DOM.
//
// This gate pins the *ceiling*, not the exact number. The ceiling is now zero:
// the 2026-09 consolidation pass retired every unreachable rule across all
// twenty sheets (552 rules / 1680 lines), the last 1,066-line block removed by
// `npm run audit:dead-css -- --prune --write` because it sat past the reach of
// the workspace's file-editing path. Deleting is still free; adding a rule that
// nothing can render now fails here.
//
// The audit scans every non-module sheet under app/, so this gate covers the
// whole corpus. It used to scan three, which is how the other eleven sheets
// accumulated dead rules unnoticed.

const MAX_DEAD_RULES = 0;
const MAX_DEAD_LINES = 0;

const runAudit = () => {
  const output = execFileSync("node", ["scripts/dead-css-audit.mjs", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output);
};

test("stylesheets do not grow unreachable rules", () => {
  const report = runAudit();

  assert.ok(report.totals.rules > 0, "the audit parsed no rules at all");
  // Discovery, not a hardcoded list — a sheet that stops being found would
  // otherwise shrink the gate silently. Twenty sheets is the 2026-09 corpus.
  assert.ok(
    report.sheets.length >= 20,
    `the audit found only ${report.sheets.length} sheets; expected the whole corpus`,
  );

  for (const sheet of report.sheets) {
    assert.ok(
      sheet.rules > 0,
      `${sheet.sheet}: no rules parsed — the audit or the sheet moved`,
    );
  }

  assert.ok(
    report.totals.dead <= MAX_DEAD_RULES,
    `unreachable rules grew: ${report.totals.dead} > ${MAX_DEAD_RULES}. ` +
      `Run \`npm run audit:dead-css -- --list\` for the rules and ` +
      `\`npm run audit:dead-css -- --prune\` for what could be removed, then ` +
      `either delete them or explain them in plans/admin-css-consolidation.md.`,
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
