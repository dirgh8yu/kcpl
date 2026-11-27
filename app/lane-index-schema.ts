import { laneFor, laneIndex, laneSlugs } from "./lane-data.ts";
import { absoluteUrl } from "./seo.ts";
import { sitePath, type SiteLocale } from "./site-i18n.ts";

/**
 * The lane index as a list: every corridor the page links to, in the order it
 * links them, on the locale's own path. The index is the one page that names
 * all of them, so this is how a crawler learns the set without crawling them.
 */
export function laneIndexItemListNode(locale: SiteLocale) {
  const path = sitePath(locale, "/lanes");
  return {
    "@type": "ItemList",
    "@id": `${absoluteUrl(path)}#lanes`,
    name: laneIndex[locale].title,
    numberOfItems: laneSlugs.length,
    itemListElement: laneSlugs.map((slug, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: laneFor(locale, slug).title,
      url: absoluteUrl(sitePath(locale, `/lanes/${slug}`)),
    })),
  };
}

