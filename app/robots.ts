import type { MetadataRoute } from "next";
import { absoluteUrl } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Crawlers must be able to fetch portal/admin responses to see their noindex header.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
