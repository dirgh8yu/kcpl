const FIREBASE_APP_HOSTING_ORIGIN = "https://kcpl--kcpl-82574.asia-southeast1.hosted.app";

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function allowedOrigins(request: Request) {
  const allowed = new Set<string>([FIREBASE_APP_HOSTING_ORIGIN]);

  const configured = [
    process.env.NEXT_PUBLIC_SITE_URL,
    ...(process.env.KCPL_ALLOWED_ORIGINS ?? "").split(","),
  ];
  for (const value of configured) {
    const origin = normalizeOrigin(value);
    if (origin) allowed.add(origin);
  }

  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) allowed.add(requestOrigin);

  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto")) || "https";
  if (forwardedHost) {
    const origin = normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    if (origin) allowed.add(origin);
  }

  const host = request.headers.get("host")?.trim();
  if (host) {
    const origin = normalizeOrigin(`https://${host}`);
    if (origin) allowed.add(origin);
  }

  return allowed;
}

export function isTrustedSameOriginRequest(request: Request) {
  const origin = normalizeOrigin(request.headers.get("origin"));

  // Firebase App Hosting proxies requests through Google infrastructure, so the
  // internal request URL/Host and Fetch Metadata can differ from the public page.
  // An exact public Origin match is therefore authoritative for browser writes.
  if (origin) return allowedOrigins(request).has(origin);

  // Non-browser clients often omit Origin. Reject only when Fetch Metadata
  // explicitly identifies the request as cross-site. Protected admin routes still
  // require a valid Firebase session/token in addition to this check.
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  return fetchSite !== "cross-site";
}
