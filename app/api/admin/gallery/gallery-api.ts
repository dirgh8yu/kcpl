import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

export function galleryJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function authorizeGallery(request?: Request) {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return { response: galleryJson({ ok: false, error: "Sign in is required." }, 401) };
  if (access.kind !== "authorized") return { response: galleryJson({ ok: false, error: "KCPL admin access is unavailable." }, 503) };
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return { response: galleryJson({ ok: false, error: "Management access is required." }, 403) };
  if (request && !isTrustedSameOriginRequest(request)) return { response: galleryJson({ ok: false, error: "Cross-origin changes are not accepted." }, 403) };
  return { user: access.user };
}

export function galleryText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
