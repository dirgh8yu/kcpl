/* One service list drives the overview, the seven detail pages, the routing,
 * the sitemap and the schema.org graph, so a service cannot exist in the
 * navigation and be missing as a page. It lives apart from the components that
 * render it so data-only readers -- the sitemap, the structured data -- can
 * import it without pulling the page components in behind it. The photographs
 * are in site-photos.ts, which only the pages import. */
export const services = [
  { slug: "air-freight", key: "air" },
  { slug: "ocean-freight", key: "ocean" },
  { slug: "road-freight", key: "road" },
  { slug: "customs-clearance", key: "customs" },
  { slug: "project-cargo", key: "project" },
  { slug: "warehousing", key: "warehouse" },
  { slug: "delivery", key: "delivery" },
] as const;

export type ServiceKey = (typeof services)[number]["key"];
export type ServiceSlug = (typeof services)[number]["slug"];
