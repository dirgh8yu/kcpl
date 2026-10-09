import { markTdsDeposited } from "../../../../../admin/finance/tax-books.server";
import { creditError, financeWriteRequest, json } from "../../credit-route-auth";

/** TDS KCPL withheld, recorded as deposited with the tax office. */
export async function POST(request: Request) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const ids = Array.isArray(auth.body.ids) ? auth.body.ids.filter((id): id is string => typeof id === "string") : [];
  const result = await markTdsDeposited(ids, {
    reference: typeof auth.body.reference === "string" ? auth.body.reference : "",
    depositedOn: typeof auth.body.depositedOn === "string" ? auth.body.depositedOn : "",
  }, auth.actor, auth.staff);
  if (result.kind === "updated") return json({ ok: true, count: result.count });
  if (result.kind === "already_deposited") return json({ ok: false, error: "Some of these are already recorded as deposited." }, 409);
  return creditError(result.kind);
}
