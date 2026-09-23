import type { MetadataRoute } from "next";
import { services } from "./components/services-page";
import { absoluteUrl, languageAlternates } from "./seo";
import { siteLocales, sitePath } from "./site-i18n";

const publicPaths = ["/", "/services", "/sectors", "/network", "/about", "/contact", "/quote", "/track", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...publicPaths, ...services.map((service) => `/services/${service.slug}`)];
  return paths.flatMap((path) =>
    siteLocales.map((locale) => ({
      url: absoluteUrl(sitePath(locale, path)),
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
