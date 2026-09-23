import { createHash } from "node:crypto";
import { services } from "./services-data.ts";
import { guides, guideSlugs, type GuideSlug } from "./guide-data.ts";
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
  "/": ["home.", "stats.", "svc."],
  "/services": ["services.", "svc."],
  "/sectors": ["sectors."],
  "/network": ["network."],
  "/about": ["about.", "stats."],
  "/contact": ["contact."],
  "/quote": ["quote."],
  "/track": ["track."],
  "/privacy": ["privacy."],
  "/terms": ["terms."],
};

function prefixesFor(path: string) {
  const service = services.find((entry) => path === `/services/${entry.slug}`);
  if (service) return [...sharedPrefixes, "services.", `svc.${service.key}.`];
  return [...sharedPrefixes, ...(pagePrefixes[path] ?? [])];
}

/**
 * The content fingerprint of one path in one language. Only the dictionary is
 * hashed: a layout change alters how the page looks, not what it says, and
 * claiming an editorial change when the markup moved is the inaccuracy that
 * makes lastmod worthless.
 */
export function contentFingerprint(locale: SiteLocale, path: string) {
  const guideSlug = path.startsWith("/guides/") ? path.slice("/guides/".length) : "";
  if (guideSlugs.includes(guideSlug as GuideSlug)) {
    return createHash("sha256").update(JSON.stringify(guides[locale][guideSlug as GuideSlug])).digest("hex").slice(0, 16);
  }
  const dictionary = siteDictionary(locale);
  const prefixes = prefixesFor(path);
  const entries = Object.keys(dictionary)
    .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
    .sort()
    .map((key) => `${key}=${dictionary[key as keyof typeof dictionary]}`);
  return createHash("sha256").update(entries.join("\n")).digest("hex").slice(0, 16);
}

/** Every path the sitemap covers, so the script and the sitemap agree on the set. */
export function sitemapPaths() {
  return [...Object.keys(pagePrefixes), ...services.map((service) => `/services/${service.slug}`), ...guideSlugs.map((slug) => `/guides/${slug}`)];
}

export function fingerprintAll() {
  const out: Record<string, string> = {};
  for (const path of sitemapPaths()) {
    for (const locale of siteLocales) out[`${locale}${path}`] = contentFingerprint(locale, path);
  }
  return out;
}
