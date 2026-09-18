import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// `npm run audit:dead-css -- --prune --write` deletes rules from the admin
// stylesheets. This workspace's file-editing path cannot reach past roughly the
// first 64 KB of a 146 KB sheet, so the tool that proves a rule is dead also has
// to remove it — which makes it the one script here that can damage live
// styling. These cases exercise it on a throwaway sheet in the OS temp
// directory, never on the real ones.
//
// The fixture mixes rules the app renders (`kcpl-admin-content`, `ops-field` are
// both in the liveness set) with retired ones, so a bug that deletes too much is
// visible as a missing live rule rather than as a smaller file.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const AUDIT = path.join(ROOT, "scripts", "dead-css-audit.mjs");

const LIVE_RULE = `.kcpl-admin-content .ops-field {
  min-height: var(--app-control-height);
}`;

const NESTED_LIVE_RULE = `.kcpl-admin-content .ops-field {
    min-height: 40px;
  }`;

const DEAD_RULE = `.kcpl-admin-content .pickup-reference-layout {
  min-width: 0;
}`;

const NESTED_DEAD_RULE = `.kcpl-admin-content .pickup-panel-summary {
    background: var(--admin-surface-muted);
  }`;

const FIXTURE = `/* A fixture sheet for the prune guards. */
${LIVE_RULE}

/* Retired: nothing renders pickup-reference-layout. */
${DEAD_RULE}

@media (max-width: 760px) {
  ${NESTED_LIVE_RULE}
  /* Retired nested rule. */
  ${NESTED_DEAD_RULE}
}
`;

const tempSheet = (contents) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kcpl-dead-css-"));
  const file = path.join(dir, "fixture.css");
  fs.writeFileSync(file, contents);
  return file;
};

const runPrune = (file, { write = true } = {}) => {
  const args = [AUDIT, "--file", file, "--prune", "--json"];
  if (write) args.push("--write");
  try {
    const stdout = execFileSync("node", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return { status: 0, stdout };
  } catch (error) {
    return { status: error.status ?? 1, stdout: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
};

test("a dead rule and a nested dead rule are removed, and the live rules survive", () => {
  const file = tempSheet(FIXTURE);
  const result = runPrune(file);
  assert.equal(result.status, 0);
  const after = fs.readFileSync(file, "utf8");

  assert.doesNotMatch(after, /pickup-reference-layout/, "the retired top-level rule should be gone");
  assert.doesNotMatch(after, /pickup-panel-summary/, "the retired nested rule should be gone");
  // The live declarations must survive byte-for-byte, including the nested one.
  assert.ok(after.includes(LIVE_RULE), "the top-level live rule changed");
  assert.ok(after.includes(NESTED_LIVE_RULE), "the nested live rule changed");
  assert.ok(after.includes("@media (max-width: 760px) {"), "the at-rule prelude was removed");
  const balance = (text) => (text.match(/\{/g) ?? []).length - (text.match(/\}/g) ?? []).length;
  assert.equal(balance(after), balance(FIXTURE), "brace balance changed");
});

test("a dry run reports the cut and leaves the file untouched", () => {
  const file = tempSheet(FIXTURE);
  const result = runPrune(file, { write: false });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /would remove/);
  assert.equal(fs.readFileSync(file, "utf8"), FIXTURE, "the dry run modified the file");
});

test("a sheet with nothing dead is left alone", () => {
  const file = tempSheet(FIXTURE.replace(DEAD_RULE, "").replace(NESTED_DEAD_RULE, ""));
  const before = fs.readFileSync(file, "utf8");
  const result = runPrune(file);
  assert.equal(result.status, 0);
  assert.equal(fs.readFileSync(file, "utf8"), before, "a sheet with no dead rules was modified");
});

test("a dead rule sharing a line with a live rule refuses and makes no change", () => {
  // Cutting this span would take the live rule's own line with it. The guard has
  // to fail closed, and the exit code has to say so.
  const file = tempSheet(`${LIVE_RULE} ${DEAD_RULE}\n`);
  const before = fs.readFileSync(file, "utf8");
  const result = runPrune(file);
  assert.equal(result.status, 1, "the prune should have refused and exited non-zero");
  assert.match(result.stdout, /REFUSED/);
  assert.equal(fs.readFileSync(file, "utf8"), before, "a refused prune modified the file");
});

test("a dead rule starting mid-line refuses", () => {
  const file = tempSheet(`.kcpl-admin-content .ops-field { color: red } .kcpl-admin-content .pickup-panel-summary {\n  background: none;\n}\n`);
  const before = fs.readFileSync(file, "utf8");
  const result = runPrune(file);
  assert.equal(result.status, 1, "the prune should have refused and exited non-zero");
  assert.equal(fs.readFileSync(file, "utf8"), before, "a refused prune modified the file");
});
