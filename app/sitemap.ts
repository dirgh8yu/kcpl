import type { MetadataRoute } from "next";
import { absoluteUrl, languageAlternates } from "./seo";
import lastmodManifest from "./sitemap-lastmod.json";
import { sitemapPaths } from "./sitemap-content.ts";
import { siteLocales, sitePath } from "./site-i18n";

/* lastmod comes from app/sitemap-lastmod.json, which scripts/sitemap-lastmod.mjs
 * stamps only when a page's own copy changes. A date that moved because some
 * other page was edited would teach search engines to ignore the field, so a
 * page with no recorded date ships without one rather than with a guess. */
const entries: Record<string, { lastmod: string }> = lastmodManifest.entries;

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths().flatMap((path) =>
    siteLocales.map((locale) => {
      const recorded = entries[`${locale}${path}`];
      return {
        url: absoluteUrl(sitePath(locale, path)),
        ...(recorded ? { lastModified: new Date(`${recorded.lastmod}T00:00:00Z`) } : {}),
        alternates: { languages: languageAlternates(path) },
      };
    }),
  );
}
