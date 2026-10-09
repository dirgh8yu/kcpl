import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Finance staff, same-origin, with a readable JSON body; or the response that refuses them. */
export async function financeWriteRequest(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { ok: false as const, response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return { ok: false as const, response: json({ ok: false, error: "Finance access is restricted to Management and Accounts." }, 403) };
  if (!isTrustedSameOriginRequest(request)) return { ok: false as const, response: json({ ok: false, error: "Cross-origin finance updates are not accepted." }, 403) };
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return { ok: false as const, response: json({ ok: false, error: "The request could not be read." }, 400) }; }
  return { ok: true as const, staff, body, actor: { name: access.user.displayName, email: access.user.email } };
}

export const creditErrors: Record<string, [string, number]> = {
  unavailable: ["Finance storage is unavailable.", 503],
  forbidden: ["This credit or invoice is outside your finance or branch access.", 403],
  missing: ["Not found.", 404],
  reason_required: ["Say why the money is being refunded.", 400],
  note_required: ["Say why the refund is rejected.", 400],
  invalid_amount: ["Enter an amount greater than zero.", 400],
  exceeds_available: ["That is more than this credit has free, or more than the invoice owes.", 409],
  inconsistent_credit: ["This credit's figures don't add up. Ask Management to check it before using it.", 422],
  invalid_status: ["This refund can't be moved on from where it is.", 409],
  management_only: ["Only Management can approve or reject a refund.", 403],
  own_request: ["A refund is approved by someone other than the person who asked for it.", 403],
  invalid_date: ["Enter the date the refund was paid, not a future date.", 400],
  invalid_method: ["Choose how the refund was paid.", 400],
  reference_required: ["Enter the bank, cheque or wallet reference for the refund.", 400],
  other_customer: ["A credit can only be used on the same customer's invoices.", 409],
  currency_mismatch: ["A credit can only be used on an invoice in the same currency.", 409],
  nothing_owed: ["That invoice owes nothing now.", 409],
  invalid_financial_state: ["That invoice's totals are inconsistent and need Accounts review.", 422],
};

export function creditError(kind: string) {
  const [error, status] = creditErrors[kind] ?? ["The request could not be completed.", 400];
  return json({ ok: false, error }, status);
}
