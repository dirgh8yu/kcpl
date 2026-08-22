import { getAdminAccess } from "../../../../../../admin/admin-auth";
import { recordPayablePaymentWithSettlementIntegrity } from "../../../../../../admin/financial-settlement/payables-settlement.server";
import { financePaymentMethods, type FinancePaymentMethod } from "../../../../../../admin/finance/finance-data";
import { ensureFreightAuditForPayment } from "../../../../../../admin/freight-audit/freight-audit.server";
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

  // Keep the existing audit materialisation/guidance path for UX. The mutation
  // below re-reads the audit and all economic fingerprint sources in the same
  // Firestore transaction as the money movement, which closes the TOCTOU gap.
  const gate = await ensureFreightAuditForPayment(reference, staff);
  if (gate.kind === "blocked") return json({ ok: false, error: "Match-Pay is blocking payment. Resolve the freight audit discrepancy or obtain Management variance approval first.", code: "FREIGHT_AUDIT_BLOCKED", audit: gate.audit }, 409);
  if (gate.kind === "missing") return json({ ok: false, error: "Supplier bill not found." }, 404);
  if (gate.kind === "forbidden") return json({ ok: false, error: "This bill is outside your finance or branch access." }, 403);
  if (gate.kind === "unavailable") return json({ ok: false, error: "Freight Audit storage is unavailable." }, 503);

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || (typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "");
  const result = await recordPayablePaymentWithSettlementIntegrity(reference, {
    amount: Number(body.amount),
    paymentDate: typeof body.paymentDate === "string" ? body.paymentDate : "",
    method: method as FinancePaymentMethod,
    reference: typeof body.reference === "string" ? body.reference : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    currency: typeof body.currency === "string" ? body.currency : null,
    idempotencyKey,
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "updated" || result.kind === "idempotent") return json({ ok: true, idempotent: result.kind === "idempotent" });
  if (result.kind === "missing") return json({ ok: false, error: "Supplier bill not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "This bill is outside your finance or branch access." }, 403);
  if (result.kind === "invalid_amount" || result.kind === "invalid_payment_date" || result.kind === "invalid_method" || result.kind === "invalid_currency") return json({ ok: false, error: "The supplier payment request is invalid." }, 400);
  if (result.kind === "already_paid") return json({ ok: false, code: "ALREADY_PAID", error: "This supplier bill is already fully paid." }, 409);
  if (result.kind === "overpayment") return json({ ok: false, code: "OVERPAYMENT", error: "The payment exceeds the current outstanding balance." }, 409);
  if (result.kind === "idempotency_conflict") return json({ ok: false, code: "IDEMPOTENCY_CONFLICT", error: "This payment idempotency key was already used for a different payment request." }, 409);
  if (result.kind === "audit_stale") return json({ ok: false, code: "FREIGHT_AUDIT_STALE", error: "The supplier bill or its commercial basis changed after Match-Pay approval. Re-audit before payment." }, 409);
  if (result.kind === "audit_blocked") return json({ ok: false, code: "FREIGHT_AUDIT_BLOCKED", error: `Match-Pay status ${result.auditStatus || "unknown"} does not permit settlement.` }, 409);
  if (result.kind === "audit_missing") return json({ ok: false, code: "FREIGHT_AUDIT_REQUIRED", error: "A current Freight Audit / Match-Pay record is required before settlement." }, 422);
  if (result.kind === "currency_mismatch") return json({ ok: false, code: "CURRENCY_MISMATCH", error: "Payment currency must exactly match the supplier invoice currency. No hidden FX conversion is allowed." }, 422);
  if (result.kind === "invalid_financial_state") return json({ ok: false, code: "INVALID_FINANCIAL_STATE", error: "The supplier bill totals or outstanding balance are inconsistent and require Accounts review." }, 422);
  if (result.kind === "invalid_status") return json({ ok: false, error: "Payments cannot be recorded against this supplier bill status." }, 409);
  return json({ ok: false, error: "Accounts Payable storage is unavailable." }, 503);
}
