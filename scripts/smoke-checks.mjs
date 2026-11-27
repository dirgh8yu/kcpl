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

/** The private surfaces answer as private: the tracker refuses and the inbox ships no records. */
export function adminGuardProblems({ trackerStatus, trackerBody, enquiriesHtml }) {
  const problems = [];
  if (trackerStatus !== 401) problems.push(`tracker answered ${trackerStatus}, expected 401`);
  if (!/sign in is required/i.test(trackerBody ?? "")) problems.push("tracker refusal body is not the sign-in message");
  if (/class="enq-row"|class="enq-layout"/.test(enquiriesHtml ?? "")) problems.push("unauthenticated enquiries page contains record markup");
  return problems;
}
