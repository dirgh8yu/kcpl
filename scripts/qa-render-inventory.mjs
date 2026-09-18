#!/usr/bin/env node
//
// KCPL QA render inventory.
//
// Reads the *rendered* admin markup from a running dev server and reports which
// utility literals and component classes actually reach the DOM. The static
// contract check (scripts/check-ui-contract.mjs) can only see what the source
// files say; this sees what the browser would receive, which is what the admin
// CSS consolidation actually needs to reason about:
//
//   * which raw literals (bg-[#091624], text-[#d4ad62], ...) the JSX really
//     renders, so the compat-layer migration can be sequenced by real usage
//     instead of alphabetically;
//   * whether .kcpl-ops-overview / .overview-* ever render, which turns the
//     "248 dead rules" finding from an inference into a measurement.
//
// It needs a dev server with the QA auth bypass enabled:
//
//   KCPL_QA_AUTH_BYPASS=true  NODE_ENV=development
//
// Usage:
//   npm run qa:render
//   npm run qa:render -- --base http://127.0.0.1:3000
//   npm run qa:render -- --routes /admin,/admin/command-centre --out .qa/render.json
//   npm run qa:render -- --json
//
// It is read-only: it issues GETs and writes nothing except an optional JSON
// report. It is intentionally NOT part of `npm test`, which must stay offline.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Mirrors the literal detection in scripts/check-ui-contract.mjs so the two
// reports are directly comparable.
const LITERAL_PATTERN = /-\[(?:#|rgba?\(|hsla?\()/;

const GATED_MARKERS = [
  "Sign in to KCPL Operations",
  "Operations access",
  "kcpl-admin-gate",
  "admin-login",
];

function parseArgs(argv) {
  const options = { base: null, routes: null, out: null, json: false, timeout: 20000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--base" && next) options.base = next.replace(/\/+$/, "");
    else if (arg === "--routes" && next) options.routes = next.split(",").map((route) => route.trim()).filter(Boolean);
    else if (arg === "--out" && next) options.out = next;
    else if (arg === "--timeout" && next) options.timeout = Number(next);
    else if (arg === "--json") options.json = true;
  }
  return options;
}

// Finds the dev server without making the caller guess a port. Freebuff injects
// PORT into managed previews, so that wins; the usual Next.js defaults follow.
async function detectBase(explicit) {
  if (explicit) return explicit;
  const candidates = [process.env.PORT, 3000, 3001, 8080, 4173, 5173].filter(Boolean);
  for (const port of candidates) {
    const base = `http://127.0.0.1:${port}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${base}/admin`, { redirect: "manual", signal: controller.signal });
      if (response.status < 500) return base;
    } catch {
      // nothing listening on this port
    } finally {
      clearTimeout(timer);
    }
  }
  return "http://127.0.0.1:3000";
}

// Pulls the class token list out of rendered class="..." / className="..."
// attributes. The streaming RSC payload in <script> tags duplicates these
// strings, so scanning attributes is both narrower and closer to the DOM.
export function renderedClasses(html) {
  const tokens = new Set();
  const attribute = /class(?:Name)?="([^"]*)"/g;
  let match;
  while ((match = attribute.exec(html)) !== null) {
    for (const token of match[1].split(/\s+/)) {
      if (token) tokens.add(token);
    }
  }
  return tokens;
}

export function detectGate(html) {
  const lower = html.toLowerCase();
  return GATED_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

async function fetchRoute(base, route, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // Redirects are followed deliberately: `/admin` legitimately 307s to the
    // command centre, and an unauthenticated route renders its gate with a 200
    // rather than redirecting. The final URL is reported so a hop is visible.
    const response = await fetch(`${base}${route}`, {
      signal: controller.signal,
      headers: { accept: "text/html", "user-agent": "kcpl-qa-render-inventory" },
    });
    const html = await response.text();
    const finalPath = new URL(response.url).pathname;
    return { status: response.status, finalPath: finalPath === route ? null : finalPath, html };
  } finally {
    clearTimeout(timer);
  }
}

async function defaultRoutes() {
  // The workspace registry is the single source of truth for admin routes, so
  // the inventory cannot drift from the navigation.
  const navigation = await import(`${ROOT}app/admin/workflow-navigation.ts`).catch(() => null);
  const registry = navigation?.workflowWorkspaces ?? [];
  const hrefs = registry.map((workspace) => workspace.href?.split("?")[0]).filter(Boolean);
  return ["/admin", ...new Set(hrefs)];
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.base = await detectBase(options.base);
  const routes = options.routes ?? (await defaultRoutes());

  const reports = [];
  const allClasses = new Set();
  let failures = 0;

  for (const route of routes) {
    try {
      const { status, finalPath, html } = await fetchRoute(options.base, route, options.timeout);
      const classes = renderedClasses(html);
      for (const token of classes) allClasses.add(token);
      const literals = [...classes].filter((token) => LITERAL_PATTERN.test(token));
      const gated = detectGate(html);
      reports.push({
        route,
        status,
        redirectedTo: finalPath,
        bytes: html.length,
        classes: classes.size,
        shell: html.includes("kcpl-admin-shell"),
        qaUser: html.includes("KCPL QA"),
        gated,
        literals: literals.sort(),
      });
    } catch (error) {
      failures += 1;
      reports.push({ route, error: error.message, status: null, literals: [] });
    }
  }

  const literalUniverse = new Set();
  for (const report of reports) for (const literal of report.literals) literalUniverse.add(literal);

  const overviewProbe = {
    kcplOpsOverview: [...allClasses].some((token) => token.includes("kcpl-ops-overview")),
    overviewStatusItem: [...allClasses].some((token) => token.includes("overview-status-item")),
  };

  const shellRoutes = reports.filter((report) => report.shell).length;
  const qaRoutes = reports.filter((report) => report.qaUser).length;

  if (options.json) {
    console.log(JSON.stringify({ base: options.base, routes: reports, literals: [...literalUniverse].sort(), overviewProbe }, null, 2));
  } else {
    console.log(`\nKCPL QA render inventory — ${options.base}`);
    console.log(`shell: ${shellRoutes}/${reports.length} routes rendered the admin shell · qa identity: ${qaRoutes}/${reports.length}\n`);
    console.log(`${pad("route", 42)}${pad("status", 7)}${pad("bytes", 9)}${pad("classes", 8)}${pad("shell", 6)}${pad("qa", 4)}${pad("lit", 5)}${pad("gate", 6)}`);
    console.log("-".repeat(87));
    for (const report of reports) {
      if (report.error) {
        console.log(`${pad(report.route, 42)}${pad("ERR", 7)}${report.error.slice(0, 40)}`);
        continue;
      }
      const suffix = report.redirectedTo ? `  → ${report.redirectedTo}` : "";
      console.log(
        `${pad(report.route, 42)}${pad(report.status, 7)}${pad(report.bytes, 9)}${pad(report.classes, 8)}${pad(report.shell ? "yes" : "no", 6)}${pad(report.qaUser ? "yes" : "no", 4)}${pad(report.literals.length, 5)}${pad(report.gated ? "yes" : "no", 6)}${suffix}`,
      );
    }

    console.log(`\nDistinct raw literals rendered: ${literalUniverse.size}`);
    for (const literal of [...literalUniverse].sort()) console.log(`  ${literal}`);

    console.log("\nDead-CSS probe (248 rules under .kcpl-ops-overview in operations-system.css):");
    console.log(`  .kcpl-ops-overview rendered: ${overviewProbe.kcplOpsOverview ? "YES — block is live, do not delete" : "no"}`);
    console.log(`  .overview-status-item rendered: ${overviewProbe.overviewStatusItem ? "YES — block is live, do not delete" : "no"}`);
    if (!overviewProbe.kcplOpsOverview && !overviewProbe.overviewStatusItem && shellRoutes > 0) {
      console.log("  → confirmed absent from rendered markup; deletion is a verified no-op.");
    } else if (shellRoutes === 0) {
      console.log("  → inconclusive: no route rendered the shell. Is KCPL_QA_AUTH_BYPASS=true set for the dev server?");
    }

    if (failures) console.log(`\n${failures} route(s) could not be read.`);
  }

  if (options.out) {
    const target = resolve(ROOT, options.out);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({ base: options.base, routes: reports, literals: [...literalUniverse].sort(), overviewProbe }, null, 2));
    console.log(`\nReport written to ${options.out}`);
  }

  if (shellRoutes === 0) process.exitCode = 1;
}

// Only run when invoked directly, so tests can import the pure parts above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
