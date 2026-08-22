import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { recordReceivablePaymentWithSettlementIntegrity } from "../../../../../../admin/financial-settlement/receivables-settlement.server";
import { financePaymentMethods, type FinancePaymentMethod } from "../../../../../../admin/finance/finance-data";
import { getStaffContext } from "../../../../../../admin/staff-directory.server";
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
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || (typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "");
  const result = await recordReceivablePaymentWithSettlementIntegrity(reference, {
    amount: Number(body.amount),
    paymentDate: typeof body.paymentDate === "string" ? body.paymentDate : "",
    method: method as FinancePaymentMethod,
    reference: typeof body.reference === "string" ? body.reference : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    currency: typeof body.currency === "string" ? body.currency : null,
    idempotencyKey,
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "updated" || result.kind === "idempotent") return json({ ok: true, idempotent: result.kind === "idempotent" });
  if (result.kind === "missing") return json({ ok: false, error: "Invoice not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This invoice is outside your finance or branch access." }, 403);
  if (["invalid_amount", "invalid_payment_date", "invalid_method", "invalid_currency"].includes(result.kind)) return json({ ok: false, error: "The payment request is invalid." }, 400);
  if (result.kind === "already_paid") return json({ ok: false, code: "ALREADY_PAID", error: "This invoice is already fully collected." }, 409);
  if (result.kind === "overpayment") return json({ ok: false, code: "OVERPAYMENT", error: "The payment exceeds the current outstanding balance." }, 409);
  if (result.kind === "idempotency_conflict") return json({ ok: false, code: "IDEMPOTENCY_CONFLICT", error: "This payment idempotency key was already used for a different collection request." }, 409);
  if (result.kind === "currency_mismatch") return json({ ok: false, code: "CURRENCY_MISMATCH", error: "Collection currency must exactly match the invoice currency. No hidden FX conversion is allowed." }, 422);
  if (result.kind === "invalid_financial_state") return json({ ok: false, code: "INVALID_FINANCIAL_STATE", error: "The invoice totals or outstanding balance are inconsistent and require Accounts review." }, 422);
  if (result.kind === "invalid_status") return json({ ok: false, error: "Payments cannot be recorded against this invoice status." }, 409);
  return json({ ok: false, error: "Finance storage is unavailable." }, 503);
}
