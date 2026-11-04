import type { NextConfig } from "next";

/* Sent with every response, including the sign-in pages. HSTS leaves out
 * includeSubDomains because other hosts under the domain may not serve HTTPS.
 * The enforced CSP only covers what cannot break a page. The report-only policy
 * logs what a full one would block to the browser console, so it can be enforced
 * once Firebase, Turnstile, the map and analytics are all confirmed clean. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://tiles.openfreemap.org https://challenges.cloudflare.com https://www.googletagmanager.com https://*.google-analytics.com",
      "frame-src 'self' blob: https://challenges.cloudflare.com https://*.firebaseapp.com https://*.web.app",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

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
  /* App Hosting turns the image optimiser off unless `unoptimized` is explicitly
   * false, and every phone then downloads the full 2200px photo. AVIF is
   * typically 20-30% smaller than WebP on the freight photography, which is what
   * the hero LCP is waiting on; WebP stays for anything that cannot take AVIF.
   * Instances scale to zero and lose their disk cache, so a long TTL keeps
   * visitors off a cold encode. Replace a photo under a new filename, because
   * there is no way to invalidate this cache. */
  images: { unoptimized: false, formats: ["image/avif", "image/webp"], minimumCacheTTL: 2678400 },
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
    return [
      { source: "/:path*", headers: securityHeaders },
      ...["/admin/:path*", "/portal/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
