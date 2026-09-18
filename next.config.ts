import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
