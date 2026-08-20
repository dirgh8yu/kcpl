import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { getFinanceInvoice, issueFinanceInvoice, voidFinanceInvoice } from "../../../../../admin/finance/finance.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return { response: json({ ok: false, error: "Finance access is restricted to Management and Accounts." }, 403) };
  return { user: access.user, staff };
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { reference } = await context.params;
  const result = await getFinanceInvoice(reference, auth.staff);
  if (result.kind === "ready") return json({ ok: true, invoice: result.invoice });
  if (result.kind === "missing") return json({ ok: false, error: "Invoice not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This invoice is outside your finance or branch access." }, 403);
  return json({ ok: false, error: "Finance storage is unavailable." }, 503);
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin finance updates are not accepted." }, 403);
  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The invoice action could not be read." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";
  const actor = { name: auth.user.displayName, email: auth.user.email };
  const result = action === "issue"
    ? await issueFinanceInvoice(reference, actor, auth.staff)
    : action === "void"
      ? await voidFinanceInvoice(reference, actor, auth.staff)
      : { kind: "invalid_action" as const };

  if (result.kind === "updated") return json({ ok: true });
  if (result.kind === "missing") return json({ ok: false, error: "Invoice not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This invoice is outside your finance or branch access." }, 403);
  if (result.kind === "has_payments") return json({ ok: false, error: "An invoice with recorded payments cannot be voided." }, 409);
  if (result.kind === "invalid_status") return json({ ok: false, error: "That action is not available for the invoice's current status." }, 409);
  if (result.kind === "unavailable") return json({ ok: false, error: "Finance storage is unavailable." }, 503);
  return json({ ok: false, error: "Choose a valid invoice action." }, 400);
}
