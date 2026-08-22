import { getAdminAccess } from "../../../admin/admin-auth";
import { getFreightAudit, listFreightAuditQueue, reviewFreightAudit } from "../../../admin/freight-audit/freight-audit.server";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 2000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return { response: json({ ok: false, error: "Freight Audit is restricted to Management and Accounts." }, 403) };
  return { user: access.user, staff };
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const reference = new URL(request.url).searchParams.get("reference")?.trim().toUpperCase() ?? "";
  if (reference) {
    const result = await getFreightAudit(reference, auth.staff, true);
    if (result.kind === "ready") return json({ ok: true, audit: result.audit });
    if (result.kind === "missing") return json({ ok: false, error: "Supplier bill not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This supplier bill is outside your finance or branch access." }, 403);
    return json({ ok: false, error: "Freight Audit storage is unavailable." }, 503);
  }
  const result = await listFreightAuditQueue(auth.staff);
  if (result.kind === "ready") return json({ ok: true, rows: result.rows, summary: result.summary, generated_at: result.generated_at });
  if (result.kind === "forbidden") return json({ ok: false, error: "Freight Audit access is restricted." }, 403);
  return json({ ok: false, error: "Freight Audit storage is unavailable." }, 503);
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin Freight Audit updates are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The Freight Audit action could not be read." }, 400); }
  const reference = clean(body.reference, 180).toUpperCase();
  const action = clean(body.action, 40) as "recheck" | "dispute" | "approve_variance" | "reject";
  const note = clean(body.note, 2000);
  if (!reference) return json({ ok: false, error: "Supplier bill reference is required." }, 400);
  if (!["recheck", "dispute", "approve_variance", "reject"].includes(action)) return json({ ok: false, error: "Choose a valid Freight Audit action." }, 400);
  const result = await reviewFreightAudit(reference, action, note, { name: auth.user.displayName, email: auth.user.email }, auth.staff);
  if (result.kind === "ready") return json({ ok: true, audit: result.audit });
  if (result.kind === "updated") return json({ ok: true, status: result.status });
  if (result.kind === "missing") return json({ ok: false, error: "Supplier bill not found." }, 404);
  if (result.kind === "forbidden" || result.kind === "management_required") return json({ ok: false, error: result.kind === "management_required" ? "Management approval is required for this variance decision." : "This supplier bill is outside your access." }, 403);
  if (result.kind === "note_required") return json({ ok: false, error: "Record a reason of at least 8 characters." }, 400);
  if (result.kind === "invalid_status") return json({ ok: false, error: "That action is not available for this audit state." }, 409);
  return json({ ok: false, error: "Freight Audit storage is unavailable." }, 503);
}
