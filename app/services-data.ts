/* One service list drives the overview, the seven detail pages, the routing,
 * the sitemap and the schema.org graph, so a service cannot exist in the
 * navigation and be missing as a page. It lives apart from the components that
 * render it so data-only readers -- the sitemap, the structured data -- can
 * import it without pulling the page components in behind it. */
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

/* Only photographs with a recorded source and no other company's branding. The service
 * pages and the home page's service list share them, so a service keeps one picture. */
export const servicePhotos: Record<ServiceSlug, { src: string; position?: string }> = {
  "air-freight": { src: "/images/unsplash/air-pallets.jpg", position: "70% 100%" },
  "ocean-freight": { src: "/images/unsplash/ship-terminal.jpg", position: "30% 50%" },
  "road-freight": { src: "/images/unsplash/ghat-trucks.jpg", position: "100% 70%" },
  "customs-clearance": { src: "/images/unsplash/container-plate.jpg", position: "20% 50%" },
  "project-cargo": { src: "/images/unsplash/heavy-lift.jpg" },
  warehousing: { src: "/images/unsplash/warehouse-racks.jpg" },
  delivery: { src: "/images/unsplash/clipboard-sign.jpg" },
};
