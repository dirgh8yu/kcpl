import { guideIndex, guides, guideSlugs } from "./guide-data.ts";
import { services } from "./services-data.ts";
import { sitePath, siteText, type SiteLocale, type SiteTextKey } from "./site-i18n.ts";
import { toolSlugs, tools } from "./tool-data.ts";

export const searchKinds = ["service", "guide", "tool", "page"] as const;
export type SearchKind = (typeof searchKinds)[number];

export type SearchEntry = {
  title: string;
  description: string;
  href: string;
  kind: SearchKind;
};

function pageEntries(locale: SiteLocale): SearchEntry[] {
  const path = (route: string) => sitePath(locale, route);
  return [
    { title: siteText(locale, "chrome.services"), description: siteText(locale, "services.intro"), href: path("/services"), kind: "page" },
    { title: siteText(locale, "chrome.work"), description: siteText(locale, "work.intro"), href: path("/work"), kind: "page" },
    { title: siteText(locale, "chrome.network"), description: siteText(locale, "network.intro"), href: path("/network"), kind: "page" },
    { title: siteText(locale, "chrome.sectors"), description: siteText(locale, "sectors.intro"), href: path("/sectors"), kind: "page" },
    { title: siteText(locale, "chrome.gallery"), description: siteText(locale, "gallery.intro"), href: path("/gallery"), kind: "page" },
    { title: siteText(locale, "chrome.awards"), description: siteText(locale, "awards.intro"), href: path("/awards"), kind: "page" },
    { title: siteText(locale, "chrome.agents"), description: siteText(locale, "agents.intro"), href: path("/agents"), kind: "page" },
    { title: siteText(locale, "chrome.faq"), description: siteText(locale, "faq.intro"), href: path("/faq"), kind: "page" },
    { title: siteText(locale, "chrome.careers"), description: siteText(locale, "careers.intro"), href: path("/careers"), kind: "page" },
    { title: siteText(locale, "chrome.about"), description: siteText(locale, "about.intro"), href: path("/about"), kind: "page" },
    { title: siteText(locale, "chrome.contact"), description: siteText(locale, "contact.intro"), href: path("/contact"), kind: "page" },
    { title: siteText(locale, "chrome.quote"), description: siteText(locale, "quote.intro"), href: path("/quote"), kind: "page" },
    { title: siteText(locale, "chrome.track"), description: siteText(locale, "track.intro"), href: path("/track"), kind: "page" },
  ];
}

/**
 * The public index is built from the same data that renders the pages, so a
 * guide, service or tool cannot be listed in search while its page is missing.
 * Search is plain case-insensitive matching: no user content, no remote index,
 * and no unbounded crawling.
 */
export function publicSearchIndex(locale: SiteLocale): SearchEntry[] {
  const serviceEntries = services.map((service) => ({
    title: siteText(locale, `svc.${service.key}.title` as SiteTextKey),
    description: siteText(locale, `svc.${service.key}.summary` as SiteTextKey),
    href: sitePath(locale, `/services/${service.slug}`),
    kind: "service" as const,
  }));
  const guideEntries = guideSlugs.map((slug) => ({
    title: guides[locale][slug].title,
    description: guides[locale][slug].description,
    href: sitePath(locale, `/guides/${slug}`),
    kind: "guide" as const,
  }));
  const toolEntries = toolSlugs.map((slug) => ({
    title: tools[locale][slug].title,
    description: tools[locale][slug].description,
    href: sitePath(locale, `/tools/${slug}`),
    kind: "tool" as const,
  }));
  return [...serviceEntries, ...guideEntries, ...toolEntries, ...pageEntries(locale), {
    title: guideIndex[locale].title,
    description: guideIndex[locale].description,
    href: sitePath(locale, "/guides"),
    kind: "page" as const,
  }];
}

export function searchPublicSite(locale: SiteLocale, query: string, limit = 24): SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return publicSearchIndex(locale)
    .map((entry) => {
      const title = entry.title.toLowerCase();
      const description = entry.description.toLowerCase();
      const score = title === needle ? 0 : title.startsWith(needle) ? 1 : title.includes(needle) ? 2 : description.includes(needle) ? 3 : 99;
      return { entry, score };
    })
    .filter((item) => item.score < 99)
    .sort((a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((item) => item.entry);
}

export function searchKindLabel(locale: SiteLocale, kind: SearchKind) {
  return {
    service: siteText(locale, "search.kind_service"),
    guide: siteText(locale, "search.kind_guide"),
    tool: siteText(locale, "search.kind_tool"),
    page: siteText(locale, "search.kind_page"),
  }[kind];
}
