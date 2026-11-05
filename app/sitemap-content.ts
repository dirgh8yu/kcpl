import { createHash } from "node:crypto";
import { services } from "./services-data.ts";
import { depthReferenceCopy, guideDepth, serviceDepth, type DepthContent } from "./content-depth.ts";
import { guideIndex, guides, guideSlugs, type GuideSlug } from "./guide-data.ts";
import { tools, toolSlugs, type ToolSlug } from "./tool-data.ts";
import { siteLocales, siteDictionary, type SiteLocale } from "./site-i18n.ts";

/*
 * A page's lastmod has to mean "this page's content changed", or search engines
 * learn to ignore the field. The copy lives in dictionaries whose keys are
 * already namespaced per page, so a page can be fingerprinted from exactly the
 * entries it renders -- a wording change on /about does not move the date on
 * /network, which is what a commit date or a build date would have done.
 */

/** The key prefixes each path renders. Chrome and company details appear in the
 * header and footer of every page, so they are in every fingerprint. */
const sharedPrefixes = ["chrome.", "company.", "cookies."];

const pagePrefixes: Record<string, string[]> = {
  "/": ["home.", "stats.", "svc.", "network.staffed_places"],
  "/services": ["services.", "svc."],
  "/sectors": ["sectors."],
  "/work": ["work.", "home.proof_"],
  "/network": ["network."],
  "/gallery": ["gallery."],
  "/awards": ["awards."],
  "/agents": ["agents."],
  "/faq": ["faq."],
  "/careers": ["careers."],
  "/about": ["about.", "stats.", "home.credibility_award", "home.credibility_storage", "home.credibility_member", "home.credibility_staff", "network.staffed_places"],
  "/contact": ["contact."],
  "/quote": ["quote."],
  "/track": ["track."],
  "/privacy": ["privacy."],
  "/terms": ["terms."],
};

function prefixesFor(path: string) {
  const service = services.find((entry) => path === `/services/${entry.slug}`);
  if (service) return [...sharedPrefixes,
    "services.covers", "services.how_title", "services.lanes_title", "services.docs_title",
    "services.questions_title", "services.ask", "services.related", `svc.${service.key}.`,
  ];
  return [...sharedPrefixes, ...(pagePrefixes[path] ?? [])];
}

/** What a tools page says: the index lists every tool's title and summary; a
 * tool's page its own copy and the shared labels around it. */
function toolPageSource(locale: SiteLocale, path: string) {
  const { index, "duty-estimate": duty, "storage-charges": storage, "volume-weight": volume, ...shared } = tools[locale];
  const pages = { "duty-estimate": duty, "storage-charges": storage, "volume-weight": volume };
  const summaries = toolSlugs.map((slug) => [pages[slug].title, pages[slug].description]);
  if (path === "/tools") return { index, eyebrow: shared.eyebrow, summaries };
  const slug = path.startsWith("/tools/") ? path.slice("/tools/".length) : "";
  if (!toolSlugs.includes(slug as ToolSlug)) return null;
  return { shared, page: pages[slug as ToolSlug], summaries };
}

/**
 * The content fingerprint of one path in one language. Only the dictionary is
 * hashed: a layout change alters how the page looks, not what it says, and
 * claiming an editorial change when the markup moved is the inaccuracy that
 * makes lastmod worthless.
 */
function depthPageSource(depth: DepthContent) {
  return { depth, references: depth.sources.length ? depthReferenceCopy : null };
}

export function contentFingerprint(locale: SiteLocale, path: string) {
  const guideSlug = path.startsWith("/guides/") ? path.slice("/guides/".length) : "";
  if (guideSlugs.includes(guideSlug as GuideSlug)) {
    const slug = guideSlug as GuideSlug;
    const source = locale === "en" ? { guide: guides[locale][slug], depth: depthPageSource(guideDepth[slug]) } : guides[locale][slug];
    return createHash("sha256").update(JSON.stringify(source)).digest("hex").slice(0, 16);
  }
  if (path === "/guides") {
    const listed = guideSlugs.map((slug) => [guides[locale][slug].title, guides[locale][slug].description]);
    return createHash("sha256").update(JSON.stringify({ index: guideIndex[locale], listed })).digest("hex").slice(0, 16);
  }
  const toolSource = toolPageSource(locale, path);
  if (toolSource) return createHash("sha256").update(JSON.stringify(toolSource)).digest("hex").slice(0, 16);
  const dictionary = siteDictionary(locale);
  const prefixes = prefixesFor(path);
  const entries = Object.keys(dictionary)
    .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
    .sort()
    .map((key) => `${key}=${dictionary[key as keyof typeof dictionary]}`);
  const service = services.find((entry) => path === `/services/${entry.slug}`);
  const depth = locale === "en" && service ? serviceDepth[service.slug] : null;
  const source = depth ? `${entries.join("\n")}\n${JSON.stringify(depthPageSource(depth))}` : entries.join("\n");
  return createHash("sha256").update(source).digest("hex").slice(0, 16);
}

/** Every path the sitemap covers, so the script and the sitemap agree on the set. */
export function sitemapPaths() {
  return [
    ...Object.keys(pagePrefixes),
    ...services.map((service) => `/services/${service.slug}`),
    "/guides",
    ...guideSlugs.map((slug) => `/guides/${slug}`),
    "/tools",
    ...toolSlugs.map((slug) => `/tools/${slug}`),
  ];
}

export function fingerprintAll() {
  const out: Record<string, string> = {};
  for (const path of sitemapPaths()) {
    for (const locale of siteLocales) out[`${locale}${path}`] = contentFingerprint(locale, path);
  }
  return out;
}
