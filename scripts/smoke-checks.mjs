/*
 * The post-deploy smoke check, as pure assertions over fetched pages.
 *
 * A deploy can report success and still serve a page that lost its schema, its
 * nav link or its auth guard. These functions take the HTML/XML the site
 * actually returned and answer with a list of problems, so the runner can be
 * pointed at production, a preview URL or a local build. Kept free of I/O so the
 * rules are tested without a network.
 */

export const laneSlugs = ["kolkata-to-birgunj", "haldia-to-kathmandu", "nepal-to-tibet"];

export const locales = [
  { id: "en", prefix: "" },
  { id: "ne", prefix: "/ne" },
  { id: "hi", prefix: "/hi" },
  { id: "zh", prefix: "/zh" },
];

const entities = { "&quot;": '"', "&#x27;": "'", "&#39;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">" };

function decode(value) {
  return value.replace(/&(?:quot|amp|lt|gt|#x27|#39);/g, (match) => entities[match] ?? match);
}

/** Every JSON-LD node on the page, flattening `@graph` containers. */
export function jsonLdNodes(html) {
  const nodes = [];
  const blocks = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(decode(block[1]));
    } catch {
      continue;
    }
    if (parsed && Array.isArray(parsed["@graph"])) nodes.push(...parsed["@graph"]);
    else nodes.push(parsed);
  }
  return nodes;
}

/** The lane links the page itself renders, as paths. */
export function laneHrefs(html, prefix = "") {
  const pattern = new RegExp(`href="(?:${prefix})?/lanes/[a-z0-9-]+"`, "g");
  return [...new Set([...html.matchAll(pattern)].map((match) => match[0].slice(6, -1)))];
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A lane index must publish an ItemList that names every lane it links, on the
 * locale's own paths, with positions numbering from one.
 */
export function laneIndexProblems({ html, prefix = "", origin }) {
  const problems = [];
  const list = jsonLdNodes(html).find((node) => node && node["@type"] === "ItemList");
  if (!list) return ["no ItemList JSON-LD"];
  const items = Array.isArray(list.itemListElement) ? list.itemListElement : [];
  if (list.numberOfItems !== items.length) problems.push(`numberOfItems ${list.numberOfItems} != ${items.length} items`);
  if (items.length === 0) problems.push("ItemList is empty");
  items.forEach((item, index) => {
    if (item.position !== index + 1) problems.push(`item ${index + 1} has position ${item.position}`);
    if (!trimmed(item.name)) problems.push(`item ${index + 1} has no name`);
    const expected = `${origin}${prefix}/lanes/`;
    if (!trimmed(item.url).startsWith(expected)) problems.push(`item ${index + 1} url ${item.url} is not under ${expected}`);
  });
  const linked = new Set(laneHrefs(html, prefix));
  const listed = new Set(items.map((item) => trimmed(item.url).replace(origin, "")));
  for (const href of linked) if (!listed.has(href)) problems.push(`page links ${href} but the ItemList omits it`);
  for (const path of listed) if (!linked.has(path)) problems.push(`ItemList names ${path} but the page does not link it`);
  if (linked.size === 0) problems.push("page links no lanes at all");
  return problems;
}

/** A lane page keeps the Service and FAQ schema, and its own canonical URL. */
export function lanePageProblems({ html, prefix = "", slug, origin }) {
  const problems = [];
  const nodes = jsonLdNodes(html);
  const service = nodes.find((node) => node && node["@type"] === "Service" && trimmed(node["@id"]).includes(`/lanes/${slug}`));
  if (!service) problems.push("no lane Service JSON-LD");
  else {
    if (!Array.isArray(service.areaServed) || service.areaServed.length < 3) problems.push("Service areaServed is not the two cities plus Nepal");
    if (!service.provider || !service.provider["@id"]) problems.push("Service has no provider @id");
  }
  const faq = nodes.find((node) => node && node["@type"] === "FAQPage");
  if (!faq) problems.push("no FAQPage JSON-LD");
  else if (!Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0) problems.push("FAQPage has no questions");
  const canonical = `${origin}${prefix}/lanes/${slug}`;
  if (!html.includes(`rel="canonical" href="${canonical}"`)) problems.push(`canonical is not ${canonical}`);
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push("no title");
  return problems;
}

/** The quote page still carries the form the lane CTAs hand values to. */
export function quotePageProblems(html) {
  const problems = [];
  if (!/<form[^>]*class="quote-card"/.test(html)) problems.push("no quote form");
  if (!html.includes('name="mode"')) problems.push("no freight mode control");
  return problems;
}

/**
 * A blog note that discusses a corridor links it, with a plain crawlable href.
 * The sample note is the Birgunj container walk-through, which named the lane's
 * subject before the link existed and must keep pointing at it.
 */
export function blogPostProblems({ html, slug }) {
  const problems = [];
  const hrefs = [...html.matchAll(/href="(\/lanes\/[a-z0-9-]+)"/g)].map((match) => match[1]);
  if (hrefs.length === 0) problems.push(`${slug} links no lane`);
  if (new RegExp(`href="/lanes/(?:${laneSlugs.join("|")})"`).test(html) === false) problems.push(`${slug} links no known lane`);
  if (!/class="link-list"/.test(html)) problems.push(`${slug} has no related-links list`);
  return problems;
}

/** The sitemap still lists the lane index and every lane page in every locale. */
export function sitemapProblems({ xml, origin }) {
  const problems = [];
  const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim()));
  for (const locale of locales) {
    const index = `${origin}${locale.prefix}/lanes`;
    if (!locs.has(index)) problems.push(`sitemap is missing ${index}`);
    for (const slug of laneSlugs) {
      const url = `${origin}${locale.prefix}/lanes/${slug}`;
      if (!locs.has(url)) problems.push(`sitemap is missing ${url}`);
    }
  }
  return problems;
}

/** The calculators, in the order the tools index lists them. */
export const toolSlugs = ["duty-estimate", "storage-charges", "volume-weight"];

/**
 * A calculator page publishes exactly one WebApplication and the one trail the
 * shell renders for every page. Two of either is as wrong as none: a duplicate
 * means the page is stating itself twice, and a parser cannot tell which wins.
 */
export function toolPageProblems({ html, prefix = "", slug, origin }) {
  const problems = [];
  const url = `${origin}${prefix}/tools/${slug}`;
  const nodes = jsonLdNodes(html);
  const apps = nodes.filter((node) => node && node["@type"] === "WebApplication");
  if (apps.length !== 1) problems.push(`${apps.length} WebApplication nodes, expected 1`);
  else {
    const app = apps[0];
    if (trimmed(app.url) !== url) problems.push(`WebApplication url ${trimmed(app.url) || "(none)"} is not ${url}`);
    if (!trimmed(app.name)) problems.push("WebApplication has no name");
    if (!trimmed(app.operatingSystem)) problems.push("WebApplication has no operatingSystem");
    if (!app.provider || !app.provider["@id"]) problems.push("WebApplication has no provider @id");
  }
  const trails = nodes.filter((node) => node && node["@type"] === "BreadcrumbList");
  if (trails.length !== 1) problems.push(`${trails.length} BreadcrumbList nodes, expected 1`);
  else {
    const items = Array.isArray(trails[0].itemListElement) ? trails[0].itemListElement : [];
    const last = items[items.length - 1];
    if (items.length < 3) problems.push(`breadcrumb has ${items.length} items, expected home, tools and the page`);
    else if (trimmed(last && last.item) !== url) problems.push(`breadcrumb ends at ${trimmed(last && last.item) || "(none)"}, not ${url}`);
    items.forEach((item, index) => {
      if (item.position !== index + 1) problems.push(`breadcrumb item ${index + 1} has position ${item.position}`);
    });
  }
  if (!html.includes(`rel="canonical" href="${url}"`)) problems.push(`canonical is not ${url}`);
  return problems;
}

/** A guide page keeps the questions it prints as FAQ schema, with answers, and its canonical. */
export function guidePageProblems({ html, prefix = "", slug, origin }) {
  const problems = [];
  const nodes = jsonLdNodes(html);
  const faqs = nodes.filter((node) => node && node["@type"] === "FAQPage");
  if (faqs.length !== 1) problems.push(`${faqs.length} FAQPage nodes, expected 1`);
  else {
    const questions = Array.isArray(faqs[0].mainEntity) ? faqs[0].mainEntity : [];
    if (questions.length === 0) problems.push("FAQPage has no questions");
    for (const question of questions) {
      if (!trimmed(question.name)) problems.push("a FAQPage question has no name");
      if (!question.acceptedAnswer || !trimmed(question.acceptedAnswer.text)) problems.push(`question "${trimmed(question.name)}" has no answer`);
    }
  }
  const url = `${origin}${prefix}/guides/${slug}`;
  if (!html.includes(`rel="canonical" href="${url}"`)) problems.push(`canonical is not ${url}`);
  return problems;
}

/** The tracker still opens with its entry box, and still hands readers to the portal. */
export function trackPageProblems(html) {
  const problems = [];
  if (!/class="track-box"/.test(html)) problems.push("no tracking entry box");
  if (!/<form[^>]*class="box-form"/.test(html)) problems.push("no tracking form");
  if (!html.includes('href="/portal"')) problems.push("no customer-portal handoff");
  return problems;
}

const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Crawlers get a wildcard rule, the API kept out of the index, and the sitemap named. */
export function robotsProblems({ status, body, origin }) {
  const problems = [];
  const text = body ?? "";
  if (status !== 200) problems.push(`/robots.txt answered ${status}`);
  if (!/user-agent:\s*\*/i.test(text)) problems.push("no wildcard user-agent group");
  if (!/disallow:\s*\/api\/?/i.test(text)) problems.push("the API is not disallowed");
  if (/^disallow:\s*\/\s*$/im.test(text)) problems.push("robots.txt disallows the whole site");
  if (!new RegExp(`sitemap:\\s*${escaped(origin)}/sitemap\\.xml`, "i").test(text)) problems.push(`no sitemap line for ${origin}/sitemap.xml`);
  return problems;
}

/**
 * A corridor that does not exist answers 404. A 200 that carries the lane's own
 * Service schema means a mistyped or retired slug is being served as a real
 * corridor, which is the soft 404 a crawler indexes.
 */
export function laneNotFoundProblems({ status, html, slug }) {
  const problems = [];
  if (status !== 404) problems.push(`/lanes/${slug} answered ${status}, expected 404`);
  const nodes = jsonLdNodes(html ?? "");
  if (nodes.some((node) => node && node["@type"] === "Service" && trimmed(node["@id"]).includes(`/lanes/${slug}`))) {
    problems.push("the response still publishes lane Service schema");
  }
  return problems;
}

/**
 * A lane page answers the notes that link it. The blog to lane link is only half
 * the trail: a reader on the corridor page should reach the note that discusses
 * it, and a lane that links none is the one-way link this check exists for.
 */
export function laneNoteProblems({ html, slug, notes }) {
  const problems = [];
  const hrefs = new Set([...html.matchAll(/href="(\/blog\/[a-z0-9-]+)"/g)].map((match) => match[1]));
  if (hrefs.size === 0) problems.push(`${slug} links no blog note`);
  for (const note of notes) if (!hrefs.has(`/blog/${note}`)) problems.push(`${slug} omits its note ${note}`);
  return problems;
}

/** The private surfaces answer as private: the tracker refuses and the inbox ships no records. */
export function adminGuardProblems({ trackerStatus, trackerBody, enquiriesHtml }) {
  const problems = [];
  if (trackerStatus !== 401) problems.push(`tracker answered ${trackerStatus}, expected 401`);
  if (!/sign in is required/i.test(trackerBody ?? "")) problems.push("tracker refusal body is not the sign-in message");
  if (/class="enq-row"|class="enq-layout"/.test(enquiriesHtml ?? "")) problems.push("unauthenticated enquiries page contains record markup");
  return problems;
}
