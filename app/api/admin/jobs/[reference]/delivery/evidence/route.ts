import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { podEvidenceDownload } from "../../../../../../admin/delivery/delivery-control.server";
import { deliveryError, podEvidenceFromForm } from "../../../../../../admin/delivery/delivery-requests.server";
import { getStaffContext } from "../../../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Digital Job File access is required." }, 403) };
  return { user: access.user, staff };
}

function errorFor(kind: string) {
  const result = deliveryError(kind);
  return json(result.body, result.status);
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin POD uploads are not accepted." }, 403);
  const { reference } = await context.params;
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ ok: false, error: "The POD upload could not be read." }, 400); }
  const result = await podEvidenceFromForm(reference, form, { name: auth.user.displayName, email: auth.user.email }, auth.staff);
  return json(result.body, result.status);
}

export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const evidenceId = new URL(request.url).searchParams.get("evidenceId")?.trim() ?? "";
  if (!evidenceId) return json({ ok: false, error: "POD evidence ID is required." }, 400);
  const result = await podEvidenceDownload(reference, evidenceId, auth.staff);
  if (result.kind !== "ready") return errorFor(result.kind);
  return Response.redirect(result.url, 302);
}
