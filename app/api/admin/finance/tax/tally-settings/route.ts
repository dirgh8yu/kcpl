import { saveTallySettings } from "../../../../../admin/finance/tax-books.server";
import { creditError, financeWriteRequest, json } from "../../credit-route-auth";

/** The ledger names the Tally export uses, matching KCPL's Tally company. */
export async function PUT(request: Request) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const result = await saveTallySettings(auth.body, auth.actor, auth.staff);
  if (result.kind === "updated") return json({ ok: true, settings: result.settings });
  return creditError(result.kind);
}
