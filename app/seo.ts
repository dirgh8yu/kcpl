import type { Metadata } from "next";
import type { ServiceContent } from "./service-content";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kapileshwor-cargo.dirgh8yu.chatgpt.site").replace(/\/$/, "");

export const siteName = "Kapileshwor Cargo Pvt. Ltd.";
export const socialImage = {
  url: `${siteUrl}/og.png`,
  width: 1729,
  height: 910,
  alt: "KCPL — Moving Nepal. Connecting the World.",
};

export function absoluteUrl(path = "/") {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createServiceMetadata(content: ServiceContent, slug: string) {
  const serviceName = content.eyebrow.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return createPageMetadata({
    title: `${serviceName} in Nepal`,
    description: `${content.intro} Learn how Kapileshwor Cargo coordinates the wider route.`,
    path: `/services/${slug}`,
  });
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
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
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
