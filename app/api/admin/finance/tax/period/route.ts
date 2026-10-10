import { loadTaxMonth } from "../../../../../admin/finance/tax-books.server";
import { fileVatPeriod, reopenVatPeriod } from "../../../../../admin/finance/vat-period-lock.server";
import { financeWriteRequest, json } from "../../credit-route-auth";

const errors: Record<string, [string, number]> = {
  unavailable: ["Finance storage is unavailable.", 503],
  forbidden: ["Only Accounts or Management staff who see every branch can mark a VAT return filed, and only Management can reopen a month.", 403],
  not_ended: ["A month can be marked filed once it is over.", 409],
  invalid_date: ["Enter the day the return was filed: after the month ended and not in the future.", 400],
  already_filed: ["This month is already marked filed.", 409],
  not_filed: ["This month isn't marked filed.", 409],
  reason_required: ["Say why the month is being reopened (at least a few words). It stays on the record.", 400],
  invalid: ["Choose a Nepali month.", 400],
};

/** Mark a Nepali month's VAT return filed, which closes its books, or (Management) reopen it. */
export async function POST(request: Request) {
  const auth = await financeWriteRequest(request);
  if (!auth.ok) return auth.response;
  const year = Number(auth.body.year);
  const month = Number(auth.body.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return json({ ok: false, error: errors.invalid[0] }, 400);
  const action = auth.body.action;
  let kind: string;
  if (action === "file") {
    // The figures the books show now are kept with the filing, to spot later changes.
    const books = await loadTaxMonth(auth.staff, year, month);
    if (books.kind !== "ready") return json({ ok: false, error: books.kind === "forbidden" ? errors.forbidden[0] : errors.unavailable[0] }, books.kind === "forbidden" ? 403 : 503);
    const summary = { output_vat: books.month.summary.output_vat, input_vat: books.month.summary.input_vat, net_vat: books.month.summary.net_vat, sales: books.month.sales.length, purchases: books.month.purchases.length };
    kind = (await fileVatPeriod(auth.staff, year, month, { filedOn: auth.body.filedOn, reference: auth.body.reference }, summary, auth.actor)).kind;
    if (kind === "filed") return json({ ok: true });
  } else if (action === "reopen") {
    kind = (await reopenVatPeriod(auth.staff, year, month, auth.body.reason, auth.actor)).kind;
    if (kind === "reopened") return json({ ok: true });
  } else {
    return json({ ok: false, error: "Unknown action." }, 400);
  }
  const [error, status] = errors[kind] ?? ["The request could not be completed.", 400];
  return json({ ok: false, error }, status);
}
