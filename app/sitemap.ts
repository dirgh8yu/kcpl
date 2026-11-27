import type { MetadataRoute } from "next";
import { absoluteUrl, languageAlternates } from "./seo";
import lastmodManifest from "./sitemap-lastmod.json";
import { sitemapLocales, sitemapPaths } from "./sitemap-content.ts";
import { sitePath } from "./site-i18n";
import { guidePhotos } from "./guide-photos.ts";
import { guideSlugs, type GuideSlug } from "./guide-data.ts";
import { blogPhotos, blogPost } from "./blog-data.ts";

/* lastmod comes from app/sitemap-lastmod.json, which scripts/sitemap-lastmod.mjs
 * stamps only when a page's own copy changes. A date that moved because some
 * other page was edited would teach search engines to ignore the field, so a
 * page with no recorded date ships without one rather than with a guess. */
const entries: Record<string, { lastmod: string }> = lastmodManifest.entries;

/* The photo each guide and post renders, so image search has a declared page
 * for it instead of finding the file through the HTML alone. */
function pageImages(path: string) {
  const guideSlug = path.startsWith("/guides/") ? path.slice("/guides/".length) : "";
  if (guideSlugs.includes(guideSlug as GuideSlug)) return [absoluteUrl(guidePhotos[guideSlug as GuideSlug].src)];
  const postSlug = path.startsWith("/blog/") ? path.slice("/blog/".length) : "";
  const post = postSlug ? blogPost(postSlug) : null;
  return post ? [absoluteUrl(blogPhotos[post.cover].src)] : [];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths().flatMap((path) => {
    const images = pageImages(path);
    return sitemapLocales(path).map((locale) => {
      const recorded = entries[`${locale}${path}`];
      return {
        url: absoluteUrl(sitePath(locale, path)),
        ...(recorded ? { lastModified: new Date(`${recorded.lastmod}T00:00:00Z`) } : {}),
        alternates: { languages: languageAlternates(path) },
        ...(images.length ? { images } : {}),
      };
    });
  });
}
