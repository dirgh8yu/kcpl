#!/usr/bin/env node
// Audit the stylesheets for rules that can never apply.
//
// Every non-module sheet under app/ is scanned by default, not just the three
// admin sheets that were originally tracked. The narrower set is why the other
// eleven sheets were able to accumulate unreachable rules unnoticed: the gate
// only ever looked at three of the twenty. `--file` still audits a single sheet.
//
// A rule is reported as unreachable ("dead") only when EVERY selector in its
// list contains at least one class token that cannot reach the DOM. Liveness is
// decided from three independent sources:
//
//   1. any string literal under app/**/*.{tsx,ts} — deliberately permissive, a
//      token that merely appears in a string counts as live
//   2. className template literals, compiled into globs, so
//      `affiliation-mark-${x}` keeps `affiliation-mark-*` alive
//   3. the rendered-token snapshot written by scripts/qa-render-inventory.mjs
//
// The audit can therefore only ever *under*-report dead rules: a false "live"
// keeps a rule, a false "dead" would be a bug worth fixing. Two earlier
// versions of this analysis were wrong in exactly that direction (a
// `className="…"`-only scan missed `className={a ? "x" : "y"}`, and a
// hyphen-only token scan missed single-word classes like `loc`), which is why
// both passes are now deliberately blunt.
//
// Rules are found recursively, so a dead rule nested in `@media` is reported
// too — a media query is not a reason for a selector to start matching.
//
// Usage:
//   npm run audit:dead-css
//   npm run audit:dead-css -- --list     # every dead rule, with its tokens
//   npm run audit:dead-css -- --spans    # contiguous deletable spans
//   npm run audit:dead-css -- --safe-runs  # runs a single edit can cut
//   npm run audit:dead-css -- --prune    # dry-run: what --safe-runs would cut
//   npm run audit:dead-css -- --prune --write   # apply the cut
//   npm run audit:dead-css -- --json     # machine-readable, for the gate test

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
// Every non-module stylesheet under app/, discovered rather than listed so a
// new sheet is covered the moment it is imported. `*.module.css` is excluded on
// purpose: its classes are consumed as `styles.foo`, never as literals, so it is
// a liveness *source* and auditing it for dead rules would be meaningless.
const SHEETS = (() => {
  const found = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(full);
      } else if (entry.name.endsWith(".css") && !entry.name.endsWith(".module.css")) {
        found.push(path.relative(ROOT, full));
      }
    }
  })(path.join(ROOT, "app"));
  return found.sort();
})();
const SNAPSHOT = path.join(ROOT, ".qa", "rendered-tokens.txt");

const wantList = process.argv.includes("--list");
const wantSpans = process.argv.includes("--spans");
const wantRegions = process.argv.includes("--regions");
const wantSafeRuns = process.argv.includes("--safe-runs");
const wantPrune = process.argv.includes("--prune");
const wantWrite = process.argv.includes("--write");
const fileArgIndex = process.argv.indexOf("--file");
const fileOverride = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : null;
const wantJson = process.argv.includes("--json");

const sourceFiles = [];
const moduleSheets = [];
(function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      sourceFiles.push(full);
    } else if (/\.module\.css$/.test(entry.name)) {
      moduleSheets.push(full);
    }
  }
})(path.join(ROOT, "app"));

const sources = sourceFiles.map((file) => fs.readFileSync(file, "utf8"));

const IGNORED_WORDS = new Set([
  "true", "false", "null", "undefined", "string", "number", "boolean", "object",
  "function", "this", "return", "const", "let", "var", "type", "interface",
  "className", "class", "String", "Number", "Boolean", "Math", "Object", "Array",
  "push", "map", "filter", "length", "trim", "split", "join", "forEach", "from",
  "import", "export", "async", "await", "default", "value", "key", "id",
]);

const live = new Set();
const addToken = (token) => {
  if (token.length < 2 || IGNORED_WORDS.has(token)) return;
  live.add(token);
};

for (const text of sources) {
  // (a) permissive hyphenated scan — catches hyphenated tokens anywhere
  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9_]+)+/g)) {
    addToken(match[0]);
  }
  // (b) every word inside a string literal, so `className="grid loc"` and
  //     `cx("ops-field", className)` both register single-word classes
  for (const match of text.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`]*)`/g)) {
    const body = match[1] ?? match[2] ?? match[3] ?? "";
    for (const word of body.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)) addToken(word[0]);
  }
}

// CSS-module class names never appear as string literals: they are consumed as
// `styles.overviewDashboardKpi`, so a scan for quoted tokens cannot see them.
// Every class defined in a `*.module.css` is therefore treated as live in both
// its kebab and camelCase spellings. Without this the module sheets look almost
// entirely dead, which is the false-positive direction that loses styling.
for (const file of moduleSheets) {
  for (const match of fs.readFileSync(file, "utf8").matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) {
    addToken(match[0]);
    addToken(match[1].replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()));
  }
}

const globs = [];
for (const text of sources) {
  for (const match of text.matchAll(/(?:className|class)\s*=\s*\{?\s*(`[^`]*`)/g)) {
    const literal = match[1].slice(1, -1);
    if (!literal.includes("${")) continue;
    const parts = literal.split(/\$\{[^}]*\}/);
    const prefix = (parts[0].match(/[A-Za-z][A-Za-z0-9_-]*$/) || [])[0];
    if (!prefix) continue;
    const suffixRaw = parts[1] !== undefined ? (parts[1].match(/^[A-Za-z0-9_-]*/) || [""])[0] : "";
    const suffix = suffixRaw && /^[a-z0-9]/.test(suffixRaw) ? suffixRaw : "";
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    globs.push(new RegExp(`^${escaped}[A-Za-z0-9_-]*${suffix}$`));
  }
}
const maybeDynamic = (cls) => globs.some((glob) => glob.test(cls));

const rendered = new Set();
if (fs.existsSync(SNAPSHOT)) {
  const raw = fs.readFileSync(SNAPSHOT, "utf8");
  for (const match of raw.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)) rendered.add(match[0]);
}

const splitSelectors = (selectorText) => {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of selectorText) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
};

// Character-level parse so at-rules and CSS nesting are handled correctly.
// Every style rule records the enclosing at-rule preludes, and a nested rule
// inherits its ancestors' selectors, so `&`-relative rules cannot hide a dead
// parent class from the check.
const parseRules = (css) => {
  // Comments are blanked rather than removed. Deleting them would shift every
  // following line, and the line numbers this reports are used to cut the file.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const found = [];
  const stack = [];
  const atStack = [];
  let ancestorSelectors = [];
  let buffer = "";
  let line = 1;
  let startLine = 1;

  for (const ch of clean) {
    if (ch === "\n") {
      line++;
      buffer += ch;
      continue;
    }
    if (ch === "{") {
      const prelude = buffer.trim();
      if (prelude.startsWith("@")) {
        stack.push({ kind: "at", prelude });
        atStack.push(prelude);
      } else {
        const expanded = ancestorSelectors.length
          ? splitSelectors(prelude)
              .map((one) => ancestorSelectors.map((a) => one.replace(/&/g, a)).join(", "))
              .join(", ")
          : prelude;
        stack.push({ kind: "rule", selector: expanded, startLine });
        ancestorSelectors = ancestorSelectors.concat(splitSelectors(prelude));
      }
      buffer = "";
      continue;
    }
    if (ch === "}") {
      const top = stack.pop();
      if (top && top.kind === "rule") {
        found.push({
          start: top.startLine,
          end: line,
          selector: top.selector,
          context: atStack.join(" && "),
        });
        ancestorSelectors = ancestorSelectors.slice(0, Math.max(0, ancestorSelectors.length - splitSelectors(top.selector).length));
      } else if (top && top.kind === "at") {
        atStack.pop();
      }
      buffer = "";
      continue;
    }
    if (ch === ";") {
      buffer = "";
      continue;
    }
    if (buffer.trim() === "" && !/\s/.test(ch)) startLine = line;
    buffer += ch;
  }
  return found;
};

const isReachable = (cls) => live.has(cls) || rendered.has(cls) || maybeDynamic(cls);

// Pull the functional pseudo-class arguments out of a compound selector.
// `:where()` and `:is()` are *selector lists*: `.a :where(.b, .c)` matches when
// either alternative matches, so a rule is only dead when EVERY alternative is
// dead. Treating any one unreachable class as fatal — which an earlier version
// of this audit did — reports live rules as dead, the one direction that can
// actually damage the stylesheet. `:not()` is dropped (it constrains nothing we
// can decide here) and `:has()` is a choice like `:is()`.
const stripFunctionalPseudo = (selector) => {
  let required = "";
  const choices = [];
  let i = 0;
  while (i < selector.length) {
    const match = /^:(where|is|has|not)\(/.exec(selector.slice(i));
    if (!match) {
      required += selector[i];
      i += 1;
      continue;
    }
    const argStart = i + match[0].length;
    let depth = 1;
    let j = argStart;
    for (; j < selector.length; j += 1) {
      if (selector[j] === "(") depth += 1;
      else if (selector[j] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (match[1] !== "not") choices.push(splitSelectors(selector.slice(argStart, j)));
    i = j + 1;
  }
  return { required, choices };
};

const selectorIsDead = (selector, seen = new Set()) => {
  const key = selector.trim();
  if (seen.has(key)) return false;
  seen.add(key);
  const { required, choices } = stripFunctionalPseudo(selector);
  const classes = [...required.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
  if (classes.some((cls) => !isReachable(cls))) return true;
  if (!classes.length && !choices.length) return false;
  // every alternative of a choice group must be dead for the group to be dead
  return choices.some((group) => group.every((alt) => selectorIsDead(alt, seen)));
};

const verdictFor = (selector) => {
  const perSelector = splitSelectors(selector).map((one) => {
    if (!selectorIsDead(one)) return null;
    const { required, choices } = stripFunctionalPseudo(one);
    const classes = [...required.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
    const unreachable = classes.filter((cls) => !isReachable(cls));
    for (const group of choices) {
      for (const alt of group) {
        for (const cls of [...alt.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1])) {
          if (!isReachable(cls)) unreachable.push(cls);
        }
      }
    }
    return unreachable.length ? unreachable : ["<unsatisfiable>"];
  });
  if (!perSelector.length || !perSelector.every(Boolean)) return null;
  return perSelector.flat();
};

// A comment line, and nothing else. The `{`/`;` exclusion matters: `* { … }` is a
// universal-selector rule, not a comment continuation, and treating it as one
// would let a cut step over a live rule.
const isCommentLine = (body) => {
  if (!body) return false;
  if (body.includes("{") || body.includes(";")) return false;
  return body.startsWith("/*") || body.startsWith("*") || body.endsWith("*/");
};

const isStructuralLine = (lines, n) => {
  const body = (lines[n - 1] ?? "").trim();
  return body === "" || isCommentLine(body);
};

// A comment block immediately above a dead rule (no blank line between them) is
// that rule's own documentation — this file's convention is comment-then-block —
// so it is retired with the rule rather than left describing a class that no
// longer exists. The walk stops at the first blank line, so a section header or
// an unrelated comment cannot be pulled in, and it is capped so a runaway
// comment block cannot clear a page of the sheet.
const COMMENT_EXTENSION_LIMIT = 8;
const extendUpOverComments = (lines, start) => {
  let top = start;
  for (let n = start - 1; n >= 1 && start - n <= COMMENT_EXTENSION_LIMIT; n -= 1) {
    if (!isCommentLine((lines[n - 1] ?? "").trim())) break;
    top = n;
  }
  if (top === start) return start;
  const above = (lines[top - 2] ?? "").trim();
  if (above === "" || above.endsWith("}") || above.endsWith("{")) return top;
  return start;
};

// The unit that can be cut without any risk of damaging the file.
//
// Each dead rule contributes its own line span (plus its attached comment), and
// spans are merged only across lines that are blank or a comment. That one
// restriction does all the work:
//
//   * an at-rule's opening (`@media (…) {`) and closing (`}`) lines are neither,
//     so a span can never cross an at-rule boundary and orphan a brace;
//   * a reachable rule's lines are neither, so a span can never swallow one;
//   * a dead rule nested in `@media`, or wedged between two live rules, is still
//     removed by its own span — which is why this covers every dead rule and not
//     just the ones that happen to be adjacent.
const computeSafeRuns = (lines, dead) => {
  const spans = dead
    .map((rule) => ({ start: extendUpOverComments(lines, rule.start), end: rule.end, rules: 1 }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last) {
      let gapIsStructural = true;
      for (let n = last.end + 1; n < span.start; n++) if (!isStructuralLine(lines, n)) gapIsStructural = false;
      if (span.start <= last.end + 1 || gapIsStructural) {
        last.end = Math.max(last.end, span.end);
        last.rules += span.rules;
        continue;
      }
    }
    merged.push({ ...span });
  }
  return merged;
};

// Brace balance with comments blanked, so a comment that mentions a brace
// cannot make a correct cut look like it unbalanced the file.
const braceBalance = (css) => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return (clean.match(/\{/g) ?? []).length - (clean.match(/\}/g) ?? []).length;
};

const inRuns = (runs, n) => runs.some((run) => n >= run.start && n <= run.end);

// Remove the verified dead runs. Every guard below fails closed, because the one
// direction that can damage the stylesheet is cutting a rule that still applies.
const pruneSheet = (full, label) => {
  const original = fs.readFileSync(full, "utf8");
  const lines = original.split("\n");
  const parsed = parseRules(original);
  const dead = parsed.filter((rule) => verdictFor(rule.selector));
  const runs = computeSafeRuns(lines, dead);

  if (!runs.length) {
    console.log(`  ${label}: nothing safely deletable`);
    return { removed: 0, runs: 0, refused: false };
  }

  const deadKeys = new Set(dead.map((rule) => `${rule.start}-${rule.end}`));
  const liveRules = parsed.filter((rule) => !deadKeys.has(`${rule.start}-${rule.end}`));
  const deadLines = new Set();
  for (const rule of dead) for (let n = rule.start; n <= rule.end; n++) deadLines.add(n);

  const bodyOf = (n) => (lines[n - 1] ?? "").trim();
  const structural = (n) => isStructuralLine(lines, n);
  // A dead rule must be covered by exactly one run, or the arithmetic below is
  // meaningless — so check it rather than trusting the merge.
  const covered = (rule) => runs.filter((run) => rule.start >= run.start && rule.end <= run.end);
  const uncovered = dead.filter((rule) => covered(rule).length !== 1);
  const expectedRemaining = dead.filter((rule) => covered(rule).length === 0);

  const refusals = [];
  if (uncovered.length) {
    refusals.push(`${uncovered.length} unreachable rules are not cleanly inside a run (e.g. line ${uncovered[0].start})`);
  }
  for (const run of runs) {
    for (const rule of liveRules) {
      if (rule.start <= run.end && rule.end >= run.start) {
        refusals.push(`run ${run.start}-${run.end} overlaps a reachable rule at ${rule.start}-${rule.end}`);
      }
    }
    for (let n = run.start; n <= run.end; n++) {
      if (!deadLines.has(n) && !structural(n)) {
        refusals.push(`run ${run.start}-${run.end} contains non-rule content at line ${n}: ${bodyOf(n).slice(0, 60)}`);
      }
    }
    // A cut line must not be shared with the line above it. Ending on `}` or `{`
    // is fine — that is a block closing, or an at-rule opening a block the run
    // sits inside, and deleting whole lines inside it leaves the braces intact.
    // Anything else means the run's first line is the tail of a longer line.
    const above = bodyOf(run.start - 1);
    const opensOrCloses = above.endsWith("}") || above.endsWith("{");
    if (above && !structural(run.start - 1) && !opensOrCloses) {
      refusals.push(`run ${run.start} starts mid-line after: ${above.slice(0, 60)}`);
    }
  }

  if (refusals.length) {
    console.log(`  ${label}: REFUSED — no change made`);
    for (const reason of refusals.slice(0, 10)) console.log(`    ${reason}`);
    return { removed: 0, runs: 0, refused: true };
  }

  const kept = lines.filter((_, index) => !inRuns(runs, index + 1));
  const after = kept.join("\n");

  // The invariants a correct cut cannot break.
  const problems = [];
  if (braceBalance(original) !== braceBalance(after)) problems.push("brace balance changed");
  const afterParsed = parseRules(after);
  const afterDead = afterParsed.filter((rule) => verdictFor(rule.selector));
  const afterLive = afterParsed.length - afterDead.length;
  if (afterLive !== liveRules.length) {
    problems.push(`reachable rules went from ${liveRules.length} to ${afterLive}`);
  }
  // The unreachable rules left behind must be exactly the ones no run covered.
  // Comparing identities rather than counts catches a cut that removes the wrong
  // rule and a cut that removes one rule too many in a single check.
  const identity = (rule) => `${rule.context} :: ${rule.selector.replace(/\s+/g, " ")}`;
  const remainingNow = afterDead.map(identity).sort();
  const remainingExpected = expectedRemaining.map(identity).sort();
  if (remainingNow.length !== remainingExpected.length) {
    problems.push(`${remainingNow.length} unreachable rules remain, expected ${remainingExpected.length}`);
  } else {
    for (let i = 0; i < remainingNow.length; i++) {
      if (remainingNow[i] !== remainingExpected[i]) {
        problems.push(`a cut removed the wrong rule: ${remainingNow[i].slice(0, 80)}`);
        break;
      }
    }
  }
  if (problems.length) {
    console.log(`  ${label}: REFUSED — no change made`);
    for (const reason of problems) console.log(`    ${reason}`);
    return { removed: 0, runs: 0, refused: true };
  }

  const removedLines = original.split("\n").length - kept.length;
  const summary = runs
    .map((run) => `${run.start}-${run.end} (${run.end - run.start + 1} lines, ${run.rules} rules)`)
    .join(", ");

  if (!wantWrite) {
    console.log(`  ${label}: would remove ${removedLines} lines in ${runs.length} runs — ${summary}`);
    console.log("    dry run: re-run with --write to apply");
    return { removed: 0, runs: runs.length, refused: false };
  }

  fs.writeFileSync(full, after);
  // Confirm the write actually landed and still parses as intended.
  const written = fs.readFileSync(full, "utf8");
  if (written !== after) {
    fs.writeFileSync(full, original);
    console.log(`  ${label}: REFUSED — write did not land; original restored`);
    return { removed: 0, runs: 0, refused: true };
  }
  console.log(`  ${label}: removed ${removedLines} lines in ${runs.length} runs — ${summary}`);
  if (expectedRemaining.length) {
    console.log(`    ${expectedRemaining.length} unreachable rules are left for a targeted review (see --list)`);
  }
  return { removed: removedLines, runs: runs.length, refused: false };
};

let pruneRefused = false;

const report = { sheets: [], totals: { rules: 0, dead: 0, lines: 0 } };

const sheets = fileOverride ? [path.resolve(ROOT, fileOverride)] : SHEETS.map((s) => path.join(ROOT, s));

for (const sheet of sheets) {
  const full = path.isAbsolute(sheet) ? sheet : path.join(ROOT, sheet);
  if (!fs.existsSync(full)) continue;
  const source = fs.readFileSync(full, "utf8");
  // A sheet that is nothing but @import statements is a load-order manifest,
  // not a stylesheet. It declares no rules to audit, and the sheets it names are
  // audited on their own. Anything with a rule in it is audited as usual, so
  // this cannot quietly excuse a sheet that stopped being parsed.
  if (!source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import\s+[^;]+;/g, "").trim()) continue;
  const parsed = parseRules(source);
  const dead = [];
  for (const rule of parsed) {
    const unreachable = verdictFor(rule.selector);
    if (unreachable) dead.push({ ...rule, unreachable });
  }
  const deadLines = dead.reduce((sum, rule) => sum + (rule.end - rule.start + 1), 0);
  report.sheets.push({
    sheet,
    rules: parsed.length,
    dead: dead.map((rule) => ({
      start: rule.start,
      end: rule.end,
      context: rule.context,
      unreachable: [...new Set(rule.unreachable)],
      selector: rule.selector.replace(/\s+/g, " ").slice(0, 160),
    })),
    deadLines,
  });
  report.totals.rules += parsed.length;
  report.totals.dead += dead.length;
  report.totals.lines += deadLines;

  if (!wantJson) {
    const label = path.isAbsolute(sheet) ? path.relative(ROOT, sheet) : sheet;
    console.log(`${label}: ${parsed.length} rules, ${dead.length} unreachable (${deadLines} lines)`);
  }
  if (wantList) {
    for (const rule of dead) {
      const where = rule.context ? `${rule.context} > ` : "";
      console.log(
        `  ${rule.start}-${rule.end}\t${[...new Set(rule.unreachable)].join(",")}\t${where}${rule.selector.replace(/\s+/g, " ").slice(0, 120)}`,
      );
    }
  }
  if (wantSpans) {
    // A span is a maximal run of consecutive dead rules with no live rule
    // between them. Deleting one therefore cannot touch a live rule: only
    // blank lines, comments and at-rule preludes can sit in the gaps.
    const sorted = [...parsed].sort((a, b) => a.start - b.start);
    const deadSet = new Set(dead.map((rule) => `${rule.start}-${rule.end}`));
    let span = null;
    const flush = () => {
      if (!span) return;
      console.log(`  span ${span.start}-${span.end}  lines=${span.end - span.start + 1}  rules=${span.n}`);
      span = null;
    };
    for (const rule of sorted) {
      if (deadSet.has(`${rule.start}-${rule.end}`)) {
        span = span
          ? { start: span.start, end: rule.end, n: span.n + 1 }
          : { start: rule.start, end: rule.end, n: 1 };
      } else {
        flush();
      }
    }
    flush();
  }

  if (wantSafeRuns || wantPrune) {
    const lines = fs.readFileSync(full, "utf8").split("\n");
    const runs = computeSafeRuns(lines, dead);
    if (wantPrune) {
      const label = path.isAbsolute(sheet) ? path.relative(ROOT, sheet) : sheet;
      const result = pruneSheet(full, label);
      if (result.refused) pruneRefused = true;
    } else {
      for (const item of runs) {
        const offset = lines.slice(0, item.start - 1).reduce((sum, l) => sum + Buffer.byteLength(l) + 1, 0);
        console.log(
          `  run ${item.start}-${item.end}  lines=${item.end - item.start + 1}  rules=${item.rules}  byteOffset=${offset}`,
        );
      }
    }
  }

  if (wantRegions) {
    // Regions widen the spans: two dead spans merge when every line between
    // them belongs to no live style rule (blank lines, comments, @keyframes and
    // stray `}` of a wrapper). A region is the unit that can be deleted in one
    // edit, so this is what the consolidation work should target.
    const sorted = [...parsed].sort((a, b) => a.start - b.start);
    const deadSet = new Set(dead.map((rule) => `${rule.start}-${rule.end}`));
    const regions = [];
    let region = null;
    for (const rule of sorted) {
      const isDead = deadSet.has(`${rule.start}-${rule.end}`);
      if (isDead) {
        if (region && rule.start <= region.end + 1) {
          region.end = rule.end;
          region.rules += 1;
        } else if (region) {
          regions.push(region);
          region = { start: rule.start, end: rule.end, rules: 1 };
        } else {
          region = { start: rule.start, end: rule.end, rules: 1 };
        }
      } else if (region && rule.start - region.end <= 12) {
        // a live rule close behind — keep the region open only if it is not
        // inside the candidate block; otherwise start a new one after it
        region.end = rule.end;
        region.blocked = true;
      }
    }
    if (region) regions.push(region);
    for (const item of regions) {
      console.log(
        `  region ${item.start}-${item.end}  lines=${item.end - item.start + 1}  dead-rules=${item.rules}${item.blocked ? "  (contains live rules — review)" : ""}`,
      );
    }
  }
}

if (wantPrune && pruneRefused) process.exitCode = 1;

if (wantJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\nTOTAL: ${report.totals.dead} unreachable rules, ${report.totals.lines} lines`);
  console.log(
    rendered.size
      ? `rendered-token snapshot: ${rendered.size} tokens (${path.relative(ROOT, SNAPSHOT)})`
      : "rendered-token snapshot: MISSING — liveness falls back to the source scan only",
  );
}

export { parseRules, splitSelectors };
