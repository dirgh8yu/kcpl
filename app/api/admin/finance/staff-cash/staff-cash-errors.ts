import { creditError, json } from "../credit-route-auth";

const staffCashErrors: Record<string, [string, number]> = {
  staff_required: ["Choose who the cash is given to.", 400],
  invalid_currency: ["Choose the currency.", 400],
  invalid_date: ["Enter a date that isn't in the future.", 400],
  purpose_required: ["Say what the cash is for.", 400],
  description_required: ["Say what the money was spent on.", 400],
  already_settled: ["This advance is already settled. Its expenses can't change now.", 409],
  shipment_missing: ["No shipment with that reference.", 404],
  invalid_method: ["Choose how the cash was given or returned.", 400],
};

export function staffCashError(kind: string) {
  const known = staffCashErrors[kind];
  return known ? json({ ok: false, error: known[0] }, known[1]) : creditError(kind);
}
