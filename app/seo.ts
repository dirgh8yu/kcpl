import type { Metadata } from "next";
import { siteLocales, sitePath, siteTranslator, type SiteLocale } from "./site-i18n";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kapileshworcargo.com.np").replace(/\/$/, "");

export const siteName = "Kapileshwor Cargo Pvt. Ltd.";
/* The link preview: one card per language (scripts/build-share-images.mjs),
 * so a Nepali page shared on WhatsApp previews in Nepali. 1200x630 is the size
 * every social scraper crops to, and JPEG keeps each card near 50KB, well under
 * WhatsApp's preview ceiling. */
export function socialImageFor(locale: SiteLocale) {
  return {
    url: `${siteUrl}/og/${locale}.jpg`,
    width: 1200,
    height: 630,
    type: "image/jpeg",
    alt: `Kapileshwor Cargo: ${siteTranslator(locale)("home.hero_title")}`,
  };
}

export const socialImage = socialImageFor("en");

export function absoluteUrl(path = "/") {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

const searchLocaleTags: Record<SiteLocale, string> = {
  en: "en",
  ne: "ne",
  zh: "zh-Hans",
  hi: "hi",
};

/** Which language a URL belongs to, and the same page stripped of its prefix. */
function localeFromPath(path: string) {
  const locale = siteLocales.find((entry) => entry !== "en" && (path === `/${entry}` || path.startsWith(`/${entry}/`)));
  return { locale: locale ?? ("en" as SiteLocale), basePath: locale ? path.slice(locale.length + 1) || "/" : path };
}

/* Open Graph wants language_TERRITORY, which hreflang does not. en_US is the
 * conventional default rather than a claim about the audience. */
const openGraphLocales: Record<SiteLocale, string> = {
  en: "en_US",
  ne: "ne_NP",
  zh: "zh_CN",
  hi: "hi_IN",
};

export function languageAlternates(path: string) {
  const { basePath } = localeFromPath(path);
  const languages = Object.fromEntries(siteLocales.map((entry) => [searchLocaleTags[entry], absoluteUrl(sitePath(entry, basePath))]));
  return { ...languages, "x-default": absoluteUrl(sitePath("en", basePath)) };
}

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const resolvedTitle = title.includes("Kapileshwor Cargo") ? title : `${title} | Kapileshwor Cargo`;

  return {
    title: { absolute: resolvedTitle },
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: openGraphLocales[localeFromPath(path).locale],
      alternateLocale: siteLocales.filter((entry) => entry !== localeFromPath(path).locale).map((entry) => openGraphLocales[entry]),
      siteName,
      title: resolvedTitle,
      description,
      url,
      images: [socialImageFor(localeFromPath(path).locale)],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: [socialImageFor(localeFromPath(path).locale).url],
    },
  };
}
