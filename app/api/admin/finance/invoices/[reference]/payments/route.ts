import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../../admin/staff-directory.server";
import { financePaymentMethods, type FinancePaymentMethod } from "../../../../../../admin/finance/finance-data";
import { recordFinancePayment } from "../../../../../../admin/finance/finance.server";
import { isTrustedSameOriginRequest } from "../../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return json({ ok: false, error: "Finance access is restricted to Management and Accounts." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin finance updates are not accepted." }, 403);
  const { reference } = await context.params;

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The payment request could not be read." }, 400); }
  const method = typeof body.method === "string" ? body.method : "other";
  if (!financePaymentMethods.includes(method as FinancePaymentMethod)) return json({ ok: false, error: "Choose a valid payment method." }, 400);
  const result = await recordFinancePayment(reference, {
    amount: Number(body.amount),
    paymentDate: typeof body.paymentDate === "string" ? body.paymentDate : "",
    method: method as FinancePaymentMethod,
    reference: typeof body.reference === "string" ? body.reference : "",
    notes: typeof body.notes === "string" ? body.notes : "",
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "updated") return json({ ok: true });
  if (result.kind === "missing") return json({ ok: false, error: "Invoice not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This invoice is outside your finance or branch access." }, 403);
  if (result.kind === "invalid_amount") return json({ ok: false, error: "Enter a valid payment that does not exceed the balance due." }, 400);
  if (result.kind === "invalid_status") return json({ ok: false, error: "Payments cannot be recorded against this invoice status." }, 409);
  return json({ ok: false, error: "Finance storage is unavailable." }, 503);
}
