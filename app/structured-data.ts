import { company } from "./company-data";
import { absoluteUrl, siteName, siteUrl } from "./seo";
import { services } from "./services-data";
import { siteLocaleTags, siteText, sitePath, type SiteLocale, type SiteTextKey } from "./site-i18n";

/* Schema.org for the public site. Everything here restates something the site
 * already says in its own markup -- address, services, the page you are on --
 * because a claim that appears only in JSON-LD is a claim a reader cannot check.
 * Opening hours, coordinates and social profiles are absent on purpose: nobody
 * has given us those, and inventing them would be inventing them. */

export const organizationId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;

/** Organization and LocalBusiness on one node: KCPL is both, and a single node
 * keeps the address from being stated twice and drifting. */
export const organizationNode = {
  "@type": ["Organization", "LocalBusiness"],
  "@id": organizationId,
  name: company.name,
  alternateName: company.shortName,
  url: siteUrl,
  logo: { "@type": "ImageObject", "@id": `${siteUrl}/#logo`, url: absoluteUrl("/images/brand/kcpl-gateway-k.svg"), caption: company.name },
  image: { "@id": `${siteUrl}/#logo` },
  foundingDate: String(company.founded),
  email: company.email,
  telephone: company.phones[0],
  address: {
    "@type": "PostalAddress",
    streetAddress: "Pragatipath Finance Complex, 2nd Floor, Mhepi Road, Sorakhutte",
    addressLocality: "Kathmandu",
    addressRegion: "Bagmati Province",
    postalCode: "44600",
    addressCountry: "NP",
  },
  areaServed: { "@type": "Country", name: "Nepal" },
  /* Coordinates read off KCPL's own Google Business listing, which carries the
   * same telephone number as this site. hasMap points back at that listing so
   * the two records can be reconciled rather than drifting. */
  geo: { "@type": "GeoCoordinates", latitude: 27.7198068, longitude: 85.3096891 },
  hasMap: "https://maps.google.com/?cid=8562049527884594447",
  /* Sunday to Friday is the Nepali working week; Saturday is stated by its
   * absence. Times are explicit because a specification without opens/closes
   * reads to some parsers as open around the clock. */
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "17:00",
  },
  sameAs: [company.instagram],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: company.phones[0],
    email: company.email,
    areaServed: "NP",
    availableLanguage: ["en", "ne", "zh", "hi"],
  },
  employee: { "@type": "Person", name: company.managingDirector, jobTitle: "Managing Director" },
  /* The seven services, named once here and read from the same list the
   * navigation and the sitemap read, so a service cannot exist in one and not
   * the other. */
  makesOffer: services.map((service) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", "@id": `${siteUrl}/services/${service.slug}#service`, name: siteText("en", `svc.${service.key}.title` as SiteTextKey) },
  })),
};

export function websiteNode(description: string) {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    url: siteUrl,
    name: siteName,
    description,
    publisher: { "@id": organizationId },
    inLanguage: Object.values(siteLocaleTags),
  };
}

/* The breadcrumb a reader would draw from the URL. Labels come from the same
 * dictionary the navigation uses, so a translated page gets a translated trail. */
const crumbLabels: Record<string, SiteTextKey> = {
  "/services": "chrome.services",
  "/sectors": "chrome.sectors",
  "/network": "chrome.network",
  "/about": "chrome.about",
  "/contact": "chrome.contact",
  "/quote": "chrome.quote",
  "/track": "chrome.track",
  "/privacy": "chrome.privacy",
  "/terms": "chrome.terms",
};

function crumbLabel(locale: SiteLocale, path: string) {
  const key = crumbLabels[path];
  if (key) return siteText(locale, key);
  const service = services.find((entry) => path === `/services/${entry.slug}`);
  return service ? siteText(locale, `svc.${service.key}.title` as SiteTextKey) : null;
}

/**
 * A trail for any public path. Home alone is not a breadcrumb, so the home page
 * gets nothing rather than a one-item list.
 */
export function breadcrumbNode(locale: SiteLocale, path: string) {
  if (path === "/") return null;
  const segments = path.split("/").filter(Boolean);
  const trail = segments.map((_, index) => `/${segments.slice(0, index + 1).join("/")}`);
  const items = [{ name: siteText(locale, "chrome.home"), path: "/" }];
  for (const step of trail) {
    const name = crumbLabel(locale, step);
    if (name) items.push({ name, path: step });
  }
  if (items.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(sitePath(locale, path))}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(sitePath(locale, item.path)),
    })),
  };
}

/** A service page describes one service KCPL provides in Nepal. */
export function serviceNode(locale: SiteLocale, slug: string) {
  const service = services.find((entry) => entry.slug === slug);
  if (!service) return null;
  return {
    "@type": "Service",
    "@id": `${siteUrl}/services/${service.slug}#service`,
    name: siteText(locale, `svc.${service.key}.title` as SiteTextKey),
    description: siteText(locale, `svc.${service.key}.summary` as SiteTextKey),
    serviceType: siteText("en", `svc.${service.key}.title` as SiteTextKey),
    provider: { "@id": organizationId },
    areaServed: { "@type": "Country", name: "Nepal" },
    url: absoluteUrl(sitePath(locale, `/services/${service.slug}`)),
  };
}

/** One @graph per page rather than a stack of script tags, so the nodes can
 * reference each other by @id instead of repeating themselves. */
export function graph(nodes: Array<Record<string, unknown> | null>) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
