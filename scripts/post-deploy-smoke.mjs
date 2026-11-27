#!/usr/bin/env node
/*
 * Post-deploy smoke check.
 *
 * Run this after App Hosting reports the rollout, against the origin the deploy
 * serves. It is the checks the last two passes ran by hand — lane index ItemList
 * on every locale, a lane page's Service and FAQ schema and canonical, the quote
 * form, the sitemap's lane URLs, and the private surfaces still private — turned
 * into one command that exits non-zero when the live site disagrees with the
 * merged code.
 *
 * The first pass covered corridors and the surfaces that must stay closed. The
 * second closed its blind spots: the twelve calculator pages (a 5xx on one of
 * them used to be invisible), the guide pages' FAQ schema, the tracker's entry
 * box, robots.txt, an unknown corridor answering 200, and a lane page that does
 * not link the notes which link it.
 *
 *   node scripts/post-deploy-smoke.mjs
 *   node scripts/post-deploy-smoke.mjs --base=https://preview.example
 *
 * The base defaults to the production origin, or SMOKE_BASE when set.
 */

import {
  adminGuardProblems,
  blogPostProblems,
  guidePageProblems,
  laneIndexProblems,
  laneNotFoundProblems,
  laneNoteProblems,
  lanePageProblems,
  laneSlugs,
  locales,
  quotePageProblems,
  robotsProblems,
  sitemapProblems,
  toolPageProblems,
  toolSlugs,
  trackPageProblems,
} from "./smoke-checks.mjs";

const arg = process.argv.find((value) => value.startsWith("--base="));
const base = (arg ? arg.slice("--base=".length) : process.env.SMOKE_BASE ?? "https://kapileshworcargo.com.np").replace(/\/$/, "");

let failures = 0;
let passes = 0;

function report(name, problems, extra = "") {
  if (problems.length) {
    failures += 1;
    console.log(`FAIL ${name}${extra}`);
    for (const problem of problems) console.log(`     ${problem}`);
  } else {
    passes += 1;
    console.log(`PASS ${name}${extra}`);
  }
}

async function fetchText(path, init) {
  const response = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "kcpl-post-deploy-smoke/1" },
    ...init,
  });
  return { status: response.status, body: await response.text() };
}

async function guard(name, run) {
  try {
    await run();
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}`);
    console.log(`     ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Post-deploy smoke: ${base}`);

for (const locale of locales) {
  await guard(`${locale.id} lane index`, async () => {
    const { status, body } = await fetchText(`${locale.prefix}/lanes`);
    const problems = status === 200 ? laneIndexProblems({ html: body, prefix: locale.prefix, origin: base }) : [`answered ${status}`];
    report(`${locale.id} lane index`, problems, ` ${locale.prefix || "/"}/lanes`);
  });
}

for (const locale of locales) {
  for (const slug of laneSlugs) {
    await guard(`${locale.id} lane ${slug}`, async () => {
      const { status, body } = await fetchText(`${locale.prefix}/lanes/${slug}`);
      const problems = status === 200 ? lanePageProblems({ html: body, prefix: locale.prefix, slug, origin: base }) : [`answered ${status}`];
      report(`${locale.id} lane ${slug}`, problems, ` ${locale.prefix || ""}/lanes/${slug}`);
    });
  }
}

for (const locale of locales) {
  for (const slug of toolSlugs) {
    await guard(`${locale.id} tool ${slug}`, async () => {
      const { status, body } = await fetchText(`${locale.prefix}/tools/${slug}`);
      const problems = status === 200 ? toolPageProblems({ html: body, prefix: locale.prefix, slug, origin: base }) : [`answered ${status}`];
      report(`${locale.id} tool ${slug}`, problems, ` ${locale.prefix}/tools/${slug}`);
    });
  }
}

await guard("guide faq", async () => {
  const slug = "importing-to-nepal";
  const { status, body } = await fetchText(`/guides/${slug}`);
  report("guide faq", status === 200 ? guidePageProblems({ html: body, slug, origin: base }) : [`answered ${status}`], ` /guides/${slug}`);
});

await guard("tracker entry", async () => {
  const { status, body } = await fetchText("/track");
  report("tracker entry", status === 200 ? trackPageProblems(body) : [`answered ${status}`], " /track");
});

await guard("robots", async () => {
  const { status, body } = await fetchText("/robots.txt");
  report("robots", robotsProblems({ status, body, origin: base }), " /robots.txt");
});

await guard("unknown lane is 404", async () => {
  const slug = "no-such-corridor";
  const { status, body } = await fetchText(`/lanes/${slug}`);
  report("unknown lane is 404", laneNotFoundProblems({ status, html: body, slug }), ` /lanes/${slug}`);
});

await guard("lane blog notes", async () => {
  const slug = "kolkata-to-birgunj";
  const notes = ["container-at-birgunj-what-happens-next"];
  const { status, body } = await fetchText(`/lanes/${slug}`);
  report("lane blog notes", status === 200 ? laneNoteProblems({ html: body, slug, notes }) : [`answered ${status}`], ` /lanes/${slug}`);
});

await guard("quote form", async () => {
  const { status, body } = await fetchText("/quote");
  report("quote form", status === 200 ? quotePageProblems(body) : [`answered ${status}`], " /quote");
});

await guard("blog corridor link", async () => {
  const slug = "container-at-birgunj-what-happens-next";
  const { status, body } = await fetchText(`/blog/${slug}`);
  report("blog corridor link", status === 200 ? blogPostProblems({ html: body, slug }) : [`answered ${status}`], ` /blog/${slug}`);
});

await guard("sitemap", async () => {
  const { status, body } = await fetchText("/sitemap.xml");
  report("sitemap", status === 200 ? sitemapProblems({ xml: body, origin: base }) : [`answered ${status}`], " /sitemap.xml");
});

await guard("private surfaces", async () => {
  const tracker = await fetchText("/api/admin/attribution/tracker");
  const enquiries = await fetchText("/admin/enquiries");
  report(
    "private surfaces",
    adminGuardProblems({ trackerStatus: tracker.status, trackerBody: tracker.body, enquiriesHtml: enquiries.body }),
    " tracker 401 + no inbox records",
  );
});

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
