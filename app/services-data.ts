/* One service list drives the overview, the seven detail pages, the routing,
 * the sitemap and the schema.org graph, so a service cannot exist in the
 * navigation and be missing as a page. It lives apart from the components that
 * render it so data-only readers -- the sitemap, the structured data -- can
 * import it without pulling the page components in behind it. */
export const services = [
  { slug: "air-freight", key: "air", image: "/images/unsplash/air-cargo.jpg" },
  { slug: "ocean-freight", key: "ocean", image: "/images/unsplash/ship-dusk.jpg" },
  { slug: "road-freight", key: "road", image: "/images/unsplash/nepal-road.jpg" },
  { slug: "customs-clearance", key: "customs", image: "/images/unsplash/port-aerial.jpg" },
  { slug: "project-cargo", key: "project", image: "/images/unsplash/port-crane.jpg" },
  { slug: "warehousing", key: "warehouse", image: "/images/unsplash/warehouse-forklift.jpg" },
  { slug: "delivery", key: "delivery", image: "/images/unsplash/forklift-loading.jpg" },
] as const;

export type ServiceKey = (typeof services)[number]["key"];
export type ServiceSlug = (typeof services)[number]["slug"];
