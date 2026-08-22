import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { financePaymentMethods, type FinancePaymentMethod } from "../../../../../../admin/finance/finance-data";
import { ensureFreightAuditForPayment } from "../../../../../../admin/freight-audit/freight-audit.server";
import { recordPayablePayment } from "../../../../../../admin/payables/payables.server";
import { getStaffContext } from "../../../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return json({ ok: false, error: "Accounts Payable is restricted to Management and Accounts." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin payable updates are not accepted." }, 403);
  const { reference } = await context.params;

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The supplier payment request could not be read." }, 400); }
  const method = typeof body.method === "string" ? body.method : "other";
  if (!financePaymentMethods.includes(method as FinancePaymentMethod)) return json({ ok: false, error: "Choose a valid payment method." }, 400);

  const gate = await ensureFreightAuditForPayment(reference, staff);
  if (gate.kind === "blocked") return json({ ok: false, error: "Match-Pay is blocking payment. Resolve the freight audit discrepancy or obtain Management variance approval first.", code: "FREIGHT_AUDIT_BLOCKED", audit: gate.audit }, 409);
  if (gate.kind === "missing") return json({ ok: false, error: "Supplier bill not found." }, 404);
  if (gate.kind === "forbidden") return json({ ok: false, error: "This bill is outside your finance or branch access." }, 403);
  if (gate.kind === "unavailable") return json({ ok: false, error: "Freight Audit storage is unavailable." }, 503);

  const result = await recordPayablePayment(reference, {
    amount: Number(body.amount),
    paymentDate: typeof body.paymentDate === "string" ? body.paymentDate : "",
    method: method as FinancePaymentMethod,
    reference: typeof body.reference === "string" ? body.reference : "",
    notes: typeof body.notes === "string" ? body.notes : "",
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "updated") return json({ ok: true });
  if (result.kind === "missing") return json({ ok: false, error: "Supplier bill not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This bill is outside your finance or branch access." }, 403);
  if (result.kind === "invalid_amount") return json({ ok: false, error: "Enter a valid payment that does not exceed the balance due." }, 400);
  if (result.kind === "invalid_status") return json({ ok: false, error: "Payments cannot be recorded against this supplier bill status." }, 409);
  return json({ ok: false, error: "Accounts Payable storage is unavailable." }, 503);
}
