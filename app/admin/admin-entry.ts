export const DEFAULT_ADMIN_LANDING = "/admin/command-centre";

export function safeAdminNext(value: string | null | undefined) {
  const candidate = (value ?? "").trim();
  if (!candidate || candidate === "/admin" || candidate.startsWith("//")) return DEFAULT_ADMIN_LANDING;
  if (!candidate.startsWith("/admin/")) return DEFAULT_ADMIN_LANDING;
  if (candidate.startsWith("/admin/login")) return DEFAULT_ADMIN_LANDING;
  return candidate;
}

export function loginHref(next?: string | null) {
  const target = safeAdminNext(next);
  return `/admin/login?next=${encodeURIComponent(target)}`;
}
