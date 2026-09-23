import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const baselinePath = "docs/ui-contract-baseline.json";
const literalPattern = /#[0-9a-fA-F]{3,8}\b|(?:text|rounded|shadow|font)-\[(?![^\]]*var\(--)[^\]]+\]|rounded-(?:xl|2xl|3xl|full)\b|<style\b|(?<![\w-])bg-(?:white|black)(?![\w/])/g;
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
function countLiterals(source) {
  const counts = {};
  for (const match of source.matchAll(literalPattern)) counts[match[0]] = (counts[match[0]] || 0) + 1;
  return counts;
}
const current = { version: 1, literals: {} };
for (const absolute of files(join(root, "app/admin")).sort()) {
  const path = relative(root, absolute).replaceAll("\\", "/");
  const source = readFileSync(absolute, "utf8");
  if (path.endsWith(".tsx")) current.literals[path] = countLiterals(source);
}
// One-time initialization. CI never writes or refreshes the baseline.
if (process.argv.includes("--initialize")) {
  if (existsSync(baselinePath)) throw new Error("Baseline already exists. Migrate the offending UI; do not reset its budget.");
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log("Created the initial UI migration baseline.");
  process.exit(0);
}
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const failures = [];
for (const [path, counts] of Object.entries(current.literals)) {
  for (const [literal, count] of Object.entries(counts)) {
    if (count > (baseline.literals[path]?.[literal] || 0)) failures.push(`${path}: new UI literal ${literal}; use an Ops primitive or operations-system.css token.`);
  }
}
// The staff stylesheets moved out of the root layout so marketing pages stop
// downloading the console, but operations-system.css still has to win last.
const product = readFileSync("app/product.css", "utf8");
const styles = [...product.matchAll(/@import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
if (styles.at(-1) !== "./admin/operations-system.css") failures.push("operations-system.css must be the final stylesheet in product.css.");
if (styles.indexOf("./brand-system.css") <= styles.indexOf("./admin/operations-polish.css")) failures.push("brand-system.css must load after the operations compatibility layers it overrides.");
const rootStyles = [...readFileSync("app/layout.tsx", "utf8").matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
if (rootStyles.some((sheet) => sheet.includes("/admin/"))) failures.push("Admin stylesheets belong in product.css, not the root layout: they load on every public page from there.");
const systemCss = readFileSync("app/admin/operations-system.css", "utf8");
if (/!important|\[class[*~^$]?=/.test(systemCss)) failures.push("Shared UI cannot use !important or utility-class substring overrides.");
for (const token of ["--app-title-size", "--app-control-height", "--app-radius", "--admin-crimson", "--admin-on-crimson", "--admin-navy", "--admin-navy-steel", "--admin-on-dark"]) {
  if (!systemCss.includes(token)) failures.push(`Missing application token: ${token}`);
}
for (const file of ["app/layout.tsx", "app/admin/layout.tsx", "app/admin/operations-shell.tsx"]) {
  if (/OperationsGlobalSearch|OperationsNavigationFallback|OperationsNotificationBridge/.test(readFileSync(file, "utf8"))) failures.push(`${file}: mount search and notifications directly through OperationsShell only.`);
}
const shell = readFileSync("app/admin/operations-shell.tsx", "utf8");
if (!shell.includes("groupedWorkspaces(capabilities)")) failures.push("Navigation must derive from workflow-navigation.ts.");
if (/can(?:ViewCommercial|ManageJobFile)\s*=\s*true/.test(shell)) failures.push("Navigation permissions must default to false.");
// PRs cannot loosen the baseline together with their implementation changes.
const base = process.env.KCPL_UI_BASE;
if (base && /^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base)) {
  const existing = execFileSync("git", ["ls-tree", "--name-only", base, baselinePath], { encoding: "utf8" }).trim();
  if (existing) {
    const previous = JSON.parse(execFileSync("git", ["show", `${base}:${baselinePath}`], { encoding: "utf8" }));
    for (const [path, counts] of Object.entries(baseline.literals)) for (const [literal, count] of Object.entries(counts)) {
      if (count > (previous.literals[path]?.[literal] || 0)) failures.push(`${path}: the legacy budget cannot increase in a PR.`);
    }
  }
}
if (failures.length) {
  console.error(`KCPL UI contract failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\nRead AGENTS.md and docs/OPERATING_SYSTEM.md.`);
  process.exitCode = 1;
} else console.log("KCPL UI contract satisfied.");
