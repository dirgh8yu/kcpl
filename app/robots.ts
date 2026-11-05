import type { MetadataRoute } from "next";
import { absoluteUrl } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Crawlers must be able to fetch portal/admin responses to see their noindex header.
    // Gallery photographs are served from /api, and belong in image search.
    rules: { userAgent: "*", allow: ["/", "/api/gallery/"], disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
