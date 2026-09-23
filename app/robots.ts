import type { MetadataRoute } from "next";
import { absoluteUrl } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/portal"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
