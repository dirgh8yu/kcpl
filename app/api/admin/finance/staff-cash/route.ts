import { vatPeriodLockedMessage } from "../../../../admin/finance/vat-period-lock";
import { giveStaffCash } from "../../../../admin/finance/staff-cash.server";
import { financeWriteRequest, json } from "../credit-route-auth";
import { staffCashError } from "./staff-cash-errors";

/** Cash handed to a member of staff, under a numbered voucher. */
export async function POST(request: Request) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const field = (key: string) => typeof auth.body[key] === "string" ? auth.body[key] as string : "";
  const result = await giveStaffCash({
    staffEmail: field("staffEmail"), staffName: field("staffName"), branch: field("branch"), currency: field("currency") || "NPR",
    amount: Number(auth.body.amount), givenOn: field("givenOn"), method: field("method") || "cash", purpose: field("purpose"),
    idempotencyKey: request.headers.get("idempotency-key")?.trim() || field("idempotencyKey"),
  }, auth.actor, auth.staff);
  if (result.kind === "created") return json({ ok: true, id: result.id, number: result.number, repeated: result.repeated });
  if (result.kind === "period_locked") return json({ ok: false, code: "PERIOD_LOCKED", error: vatPeriodLockedMessage(result.period) }, 409);
  return staffCashError(result.kind);
}
