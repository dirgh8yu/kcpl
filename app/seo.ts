import type { Metadata } from "next";
import { englishOnlyPath, siteLocales, sitePath, type SiteLocale } from "./site-i18n";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kapileshworcargo.com.np").replace(/\/$/, "");

export const siteName = "Kapileshwor Cargo Pvt. Ltd.";
/* 1200x630 is the size every social scraper crops to, and JPEG keeps the card
 * under 100KB: the 1.7MB PNG this replaced was above WhatsApp's preview ceiling,
 * so the link shared in Nepal most often was the one that showed no image. */
export const socialImage = {
  url: `${siteUrl}/og.jpg`,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "KCPL — Moving Nepal. Connecting the World.",
};

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
  if (englishOnlyPath(basePath)) return { en: absoluteUrl(basePath), "x-default": absoluteUrl(basePath) };
  const languages = Object.fromEntries(siteLocales.map((entry) => [searchLocaleTags[entry], absoluteUrl(sitePath(entry, basePath))]));
  return { ...languages, "x-default": absoluteUrl(sitePath("en", basePath)) };
}

/* A title gets about 60 characters in a result. The brand suffix is 21 of them,
 * so appending it to a long title pushes the words a buyer searched for out of
 * the snippet. Short titles keep the suffix; long ones keep the query. */
const brandSuffix = " | Kapileshwor Cargo";
const titleBudget = 60;

export function pageTitle(title: string) {
  if (title.includes("Kapileshwor Cargo")) return title;
  return title.length + brandSuffix.length <= titleBudget ? `${title}${brandSuffix}` : title;
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
  const resolvedTitle = pageTitle(title);

  return {
    title: { absolute: resolvedTitle },
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: openGraphLocales[localeFromPath(path).locale],
      alternateLocale: englishOnlyPath(path) ? [] : siteLocales.filter((entry) => entry !== localeFromPath(path).locale).map((entry) => openGraphLocales[entry]),
      siteName,
      title: resolvedTitle,
      description,
      url,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: [socialImage.url],
    },
  };
}
