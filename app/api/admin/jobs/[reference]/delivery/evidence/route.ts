import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { podEvidenceDownload, uploadPodEvidence } from "../../../../../../admin/delivery/delivery-control.server";
import { podEvidenceKinds, type PodEvidenceKind } from "../../../../../../admin/delivery/delivery-control";
import { getStaffContext } from "../../../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: FormDataEntryValue | string | null, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Digital Job File access is required." }, 403) };
  return { user: access.user, staff };
}

function errorFor(kind: string) {
  if (kind === "unavailable" || kind === "storage_unavailable") return json({ ok: false, error: "Firebase POD storage is unavailable." }, 503);
  if (kind === "missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (kind === "missing_attempt") return json({ ok: false, error: "Delivery attempt not found." }, 404);
  if (kind === "missing_evidence") return json({ ok: false, error: "POD evidence not found." }, 404);
  if (kind === "forbidden") return json({ ok: false, error: "This shipment is outside your branch access." }, 403);
  if (kind === "delivery_required") return json({ ok: false, error: "POD evidence can only be attached to a delivered attempt." }, 409);
  if (kind === "invalid_kind") return json({ ok: false, error: "Choose photo, signature or document evidence." }, 400);
  if (kind === "invalid_file") return json({ ok: false, error: "POD files must be JPEG, PNG, WebP or PDF and no larger than 12 MB." }, 400);
  if (kind === "already_verified") return json({ ok: false, error: "Verified POD is immutable." }, 409);
  return json({ ok: false, error: "POD evidence could not be processed." }, 400);
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin POD uploads are not accepted." }, 403);
  const { reference } = await context.params;
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ ok: false, error: "The POD upload could not be read." }, 400); }
  const file = form.get("file");
  const attemptId = clean(form.get("attemptId"), 180);
  const kind = clean(form.get("kind"), 40) as PodEvidenceKind;
  if (!(file instanceof File) || !attemptId || !podEvidenceKinds.includes(kind)) return json({ ok: false, error: "Delivery attempt, evidence type and file are required." }, 400);
  const result = await uploadPodEvidence(reference, attemptId, kind, file, clean(form.get("capturedAt"), 80), { name: auth.user.displayName, email: auth.user.email }, auth.staff);
  if (result.kind !== "created") return errorFor(result.kind);
  return json({ ok: true, evidence: result.evidence }, 201);
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
