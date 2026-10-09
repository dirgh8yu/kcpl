/*
 * Cash given to staff for fees paid on the spot (port and customs charges,
 * loading, small transport), the rules only. Staff bring back receipts; what
 * they spent becomes the shipments' costs, and the difference is returned to
 * KCPL or paid back to them when the advance is settled.
 */

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type StaffCashSettlement =
  | { kind: "return"; amount: number }
  | { kind: "reimburse"; amount: number }
  | { kind: "even"; amount: 0 };

/** What happens when an advance is settled: the staff member hands back the rest, or KCPL makes up what they paid from their own pocket. */
export function staffCashSettlement(given: number, spent: number): StaffCashSettlement {
  const difference = round(given - spent);
  if (difference > 0.005) return { kind: "return", amount: difference };
  if (difference < -0.005) return { kind: "reimburse", amount: -difference };
  return { kind: "even", amount: 0 };
}

export function staffCashSpent(expenses: Array<{ amount: number }>) {
  return round(expenses.reduce((sum, expense) => sum + expense.amount, 0));
}

/** An expense line as entered: positive, dated, described. */
export function validStaffExpense(input: { amount: unknown; date: string; description: string }, today: string) {
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount - round(amount)) >= 0.005) return { ok: false as const, reason: "invalid_amount" as const };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > today) return { ok: false as const, reason: "invalid_date" as const };
  if (input.description.trim().length < 3) return { ok: false as const, reason: "description_required" as const };
  return { ok: true as const, amount: round(amount) };
}

/** Days an advance has been out: one that stays open for weeks is cash nobody is accounting for. */
export function staffCashDaysOpen(givenOn: string, today: string) {
  const start = Date.parse(`${givenOn}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 86_400_000)) : 0;
}
