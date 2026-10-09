import { importStatement } from "../../../../../admin/finance/bank-statement.server";
import { creditError, financeWriteRequest, json } from "../../credit-route-auth";

/** A bank statement CSV, read into lines; lines already imported are skipped. */
export async function POST(request: Request) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const field = (key: string) => typeof auth.body[key] === "string" ? auth.body[key] as string : "";
  const result = await importStatement({ csv: field("csv"), account: field("account"), currency: field("currency") || "NPR" }, auth.actor, auth.staff);
  if (result.kind === "imported") return json({ ok: true, added: result.added, duplicates: result.duplicates, errors: result.errors });
  if (result.kind === "nothing_read") return json({ ok: false, error: result.errors[0] ?? "No transactions were found in that file.", errors: result.errors }, 400);
  if (result.kind === "account_required") return json({ ok: false, error: "Name the bank account, so lines from different accounts stay apart." }, 400);
  if (result.kind === "too_large") return json({ ok: false, error: "That file is too large. Export one month at a time." }, 413);
  if (result.kind === "invalid_currency") return json({ ok: false, error: "Choose the account's currency." }, 400);
  return creditError(result.kind);
}
