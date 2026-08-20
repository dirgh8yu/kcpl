import { getAdminAccess } from "../../../admin/admin-auth";
import { isTrustedSameOriginRequest } from "../../../request-security";

export function crmJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function authorizeCrm() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") return { user: access.user };
  if (access.kind === "signed-out") return { response: crmJson({ ok: false, error: "Sign in is required." }, 401) };
  return { response: crmJson({ ok: false, error: "Admin access is not configured." }, 503) };
}

export function protectCrmWrite(request: Request) {
  return isTrustedSameOriginRequest(request)
    ? null
    : crmJson({ ok: false, error: "Cross-origin CRM updates are not accepted." }, 403);
}

export function cleanCrmText(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
