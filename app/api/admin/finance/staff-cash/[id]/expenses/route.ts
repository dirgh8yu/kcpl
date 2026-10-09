import { addStaffExpense, removeStaffExpense } from "../../../../../../admin/finance/staff-cash.server";
import { financeWriteRequest, json } from "../../../credit-route-auth";
import { staffCashError } from "../../staff-cash-errors";

type Context = { params: Promise<{ id: string }> };

/** A receipt the staff member brought back. */
export async function POST(request: Request, context: Context) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const field = (key: string) => typeof auth.body[key] === "string" ? auth.body[key] as string : "";
  const result = await addStaffExpense(decodeURIComponent(id), {
    date: field("date"), description: field("description"), amount: Number(auth.body.amount), category: field("category"),
    shipmentReference: field("shipmentReference"), receiptNumber: field("receiptNumber"),
    idempotencyKey: request.headers.get("idempotency-key")?.trim() || field("idempotencyKey"),
  }, auth.actor, auth.staff);
  if (result.kind === "added") return json({ ok: true });
  return staffCashError(result.kind);
}

/** Take off an expense entered by mistake, while the advance is open. */
export async function DELETE(request: Request, context: Context) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const expenseId = typeof auth.body.expenseId === "string" ? auth.body.expenseId : "";
  if (!expenseId) return json({ ok: false, error: "Choose the expense to remove." }, 400);
  const result = await removeStaffExpense(decodeURIComponent(id), expenseId, auth.staff);
  if (result.kind === "removed") return json({ ok: true });
  return staffCashError(result.kind);
}
