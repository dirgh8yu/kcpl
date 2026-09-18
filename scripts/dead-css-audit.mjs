#!/usr/bin/env node
// Audit the admin stylesheets for rules that can never apply.
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
//   npm run audit:dead-css -- --json     # machine-readable, for the gate test

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SHEETS = [
  "app/admin/operations-system.css",
  "app/admin/operations-polish.css",
  "app/admin/operations-hotfix.css",
];
const SNAPSHOT = path.join(ROOT, ".qa", "rendered-tokens.txt");

const wantList = process.argv.includes("--list");
const wantSpans = process.argv.includes("--spans");
const wantRegions = process.argv.includes("--regions");
const wantSafeRuns = process.argv.includes("--safe-runs");
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

const report = { sheets: [], totals: { rules: 0, dead: 0, lines: 0 } };

const sheets = fileOverride ? [path.resolve(ROOT, fileOverride)] : SHEETS.map((s) => path.join(ROOT, s));

for (const sheet of sheets) {
  const full = path.isAbsolute(sheet) ? sheet : path.join(ROOT, sheet);
  if (!fs.existsSync(full)) continue;
  const parsed = parseRules(fs.readFileSync(full, "utf8"));
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

  if (wantSafeRuns) {
    // The unit that can be cut without any risk of damaging the file: a run of
    // consecutive TOP-LEVEL dead rules where every line between them is blank
    // or a comment. Anything else (a run that spans an at-rule prelude, or one
    // that sits inside a media query) is excluded, because cutting the range
    // wholesale would orphan a brace — the rule has to be removed on its own.
    const lines = fs.readFileSync(full, "utf8").split("\n");
    const bodyOf = (n) => (lines[n - 1] ?? "").trim();
    const structural = (n) => {
      const body = bodyOf(n);
      return body === "" || body.startsWith("/*") || body.endsWith("*/") || /^\*/.test(body);
    };
    const deadTop = dead.filter((rule) => !rule.context).sort((a, b) => a.start - b.start);
    const runs = [];
    let run = null;
    for (const rule of deadTop) {
      let contiguous = false;
      if (run) {
        let ok = true;
        for (let n = run.end + 1; n < rule.start; n++) if (!structural(n)) ok = false;
        contiguous = ok;
      }
      if (contiguous) {
        run.end = rule.end;
        run.rules += 1;
      } else {
        if (run) runs.push(run);
        run = { start: rule.start, end: rule.end, rules: 1 };
      }
    }
    if (run) runs.push(run);
    for (const item of runs) {
      const offset = lines.slice(0, item.start - 1).reduce((sum, l) => sum + Buffer.byteLength(l) + 1, 0);
      console.log(
        `  run ${item.start}-${item.end}  lines=${item.end - item.start + 1}  rules=${item.rules}  byteOffset=${offset}`,
      );
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
