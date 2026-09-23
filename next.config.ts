import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  /**
   * The hosted preview is served through a proxy rather than a bare
   * `localhost:<port>`, and Next.js blocks cross-origin requests to dev-only
   * resources (JS chunks, HMR, middleware) by default. Without this the page's
   * server-rendered HTML arrives but every chunk request is answered `403
   * Unauthorized`, so nothing hydrates: the sidebar, command palette and
   * accordions are inert and the preview cannot be used for visual QA.
   *
   * Match semantics are Next's own (`isCsrfOriginAllowed`): `*` matches one
   * label, `**` any depth. Verified against the installed 16.3.2 that
   * `*.daytonaproxy01.net` matches
   * `3000-<workspace-uuid>.daytonaproxy01.net`.
   *
   * Development only — `allowedDevOrigins` is consulted solely when
   * `next dev` is running, and never by `next build` or `next start`. If Next
   * logs a different blocked hostname, add it here.
   */
  allowedDevOrigins: ["*.daytonaproxy01.net"],
  /* Next serves WebP by default. AVIF is typically 20-30% smaller again on the
   * freight photography, which is what the hero LCP is waiting on; WebP stays
   * in the list for anything that cannot take AVIF. */
  images: { formats: ["image/avif", "image/webp"] },
  async redirects() {
    return [
      { source: "/tracking", destination: "/track", permanent: true },
      { source: "/services/sea-freight", destination: "/services/ocean-freight", permanent: true },
      { source: "/services/break-bulk-cargo", destination: "/services/project-cargo", permanent: true },
      { source: "/services/open-top-container", destination: "/services/project-cargo", permanent: true },
      { source: "/services/packaging-storage", destination: "/services/warehousing", permanent: true },
      { source: "/services/ground-transport", destination: "/services/road-freight", permanent: true },
      { source: "/services/door-to-door", destination: "/services/delivery", permanent: true },
    ];
  },
  async headers() {
    return ["/admin/:path*", "/portal/:path*"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;
