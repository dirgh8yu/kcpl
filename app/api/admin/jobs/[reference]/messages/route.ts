import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";
import { staffPostsMessage, staffReadsMessages } from "../../../../../shipment-messages.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Job File access is not available for this account." }, 403) };
  return { user: access.user, staff };
}

/** The customer conversation on the Job File. Shared with KCPL Ops through
 * shipment-messages.server.ts; branch access is checked there. */
export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const result = await staffReadsMessages(reference, auth.staff);
  return json(result.body, result.status);
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin messages are not accepted." }, 403);
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The message could not be read." }, 400);
  }
  const { reference } = await context.params;
  const result = await staffPostsMessage(reference, body ?? {}, auth.user, auth.staff);
  return json(result.body, result.status);
}
