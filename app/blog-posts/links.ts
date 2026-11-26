/* The service pages a post can send its reader to, written once. */
export const service = {
  air: { href: "/services/air-freight", label: "Air freight" },
  ocean: { href: "/services/ocean-freight", label: "Ocean freight" },
  road: { href: "/services/road-freight", label: "Road freight" },
  customs: { href: "/services/customs-clearance", label: "Customs and documentation" },
  project: { href: "/services/project-cargo", label: "Project and specialist cargo" },
  warehouse: { href: "/services/warehousing", label: "Warehousing and packaging" },
  delivery: { href: "/services/delivery", label: "Delivery and proof" },
} as const;

/** The day this batch of notes goes live. */
export const published = "2026-11-27";
