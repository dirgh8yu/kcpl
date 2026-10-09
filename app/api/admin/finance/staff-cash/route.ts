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
  return staffCashError(result.kind);
}
