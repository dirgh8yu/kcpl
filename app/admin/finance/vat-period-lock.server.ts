import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { nepalOperationalDate } from "../../invoice-effective-status";
import { bsMonthRange } from "../../nepali-calendar";
import { qaMockDataEnabled } from "../qa-fixtures";
import type { KcplStaffContext } from "../staff-directory.server";
import {
  VAT_PERIODS,
  vatFilingFromInput,
  vatPeriodId,
  vatPeriodsOfDates,
  vatReopenReasonValid,
  type VatPeriodSummary,
} from "./vat-period-lock";

/*
 * The filed-month records, one per Nepali month that has ever been filed
 * (vat_periods/{2083-06}). Every writer of a dated finance record asks
 * lockedVatPeriod first, inside its own transaction where it has one, so a
 * month being filed at the same moment is seen.
 */

type Actor = { name: string; email: string };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function num(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }

/** The first filed month any of these dates falls in, or null when all are open. */
export async function lockedVatPeriod(dates: Array<string | null | undefined>, transaction?: FirebaseFirestore.Transaction) {
  if (!firebaseRuntimeConfigured() || qaMockDataEnabled()) return null;
  const periods = vatPeriodsOfDates(dates);
  if (!periods.length) return null;
  const db = firebaseAdminDb();
  const refs = periods.map((period) => db.collection(VAT_PERIODS).doc(period.id));
  const docs = transaction ? await transaction.getAll(...refs) : await db.getAll(...refs);
  const index = docs.findIndex((doc) => doc.exists && doc.get("status") === "filed");
  return index >= 0 ? periods[index] : null;
}

export type VatPeriodHistory = { action: "filed" | "reopened"; at: string; by: string; detail: string | null };
export type VatPeriodState = {
  id: string;
  status: "open" | "filed";
  /** Over, so it can be marked filed. */
  fileable: boolean;
  filed_on: string | null;
  filing_reference: string | null;
  filed_by_name: string | null;
  filed_summary: VatPeriodSummary | null;
  history: VatPeriodHistory[];
  can_file: boolean;
  can_reopen: boolean;
};

function summaryFrom(value: unknown): VatPeriodSummary | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  return { output_vat: num(data.output_vat), input_vat: num(data.input_vat), net_vat: num(data.net_vat), sales: num(data.sales), purchases: num(data.purchases) };
}

function historyFrom(value: unknown): VatPeriodHistory[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").map((item) => ({
    action: item.action === "reopened" ? "reopened" as const : "filed" as const,
    at: text(item.at), by: text(item.by), detail: text(item.detail) || null,
  }));
}

/** Who may do what: anyone in Accounts or Management who sees every branch can mark a month filed; only Management reopens one. */
function permissions(context: KcplStaffContext) {
  const finance = context.permissions.canManageFinance && context.can_access_all_branches;
  return { can_file: finance, can_reopen: finance && context.permissions.role === "management" };
}

export async function loadVatPeriod(context: KcplStaffContext, year: number, month: number): Promise<VatPeriodState> {
  const id = vatPeriodId(year, month);
  const range = bsMonthRange(year, month);
  const base: VatPeriodState = {
    id, status: "open", fileable: Boolean(range && range.end < nepalOperationalDate()), filed_on: null, filing_reference: null, filed_by_name: null,
    filed_summary: null, history: [], ...permissions(context),
  };
  if (!firebaseRuntimeConfigured() || qaMockDataEnabled()) return base;
  const doc = await firebaseAdminDb().collection(VAT_PERIODS).doc(id).get();
  if (!doc.exists) return base;
  return {
    ...base,
    status: doc.get("status") === "filed" ? "filed" : "open",
    filed_on: text(doc.get("filed_on")) || null,
    filing_reference: text(doc.get("filing_reference")) || null,
    filed_by_name: text(doc.get("filed_by_name")) || null,
    filed_summary: summaryFrom(doc.get("filed_summary")),
    history: historyFrom(doc.get("history")),
  };
}

/** Record the return as filed, with the figures the books showed, and close the month. */
export async function fileVatPeriod(context: KcplStaffContext, year: number, month: number, input: { filedOn?: unknown; reference?: unknown }, summary: VatPeriodSummary, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!permissions(context).can_file) return { kind: "forbidden" as const };
  const checked = vatFilingFromInput(year, month, input, nepalOperationalDate());
  if (!checked.ok) return { kind: checked.error };
  const db = firebaseAdminDb();
  const ref = db.collection(VAT_PERIODS).doc(vatPeriodId(year, month));
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (doc.exists && doc.get("status") === "filed") return { kind: "already_filed" as const };
    const now = new Date().toISOString();
    const history = [...historyFrom(doc.get("history")), { action: "filed" as const, at: now, by: actor.name, detail: checked.reference ? `Reference ${checked.reference}` : null }].slice(-40);
    transaction.set(ref, {
      year, month, status: "filed", filed_on: checked.filedOn, filing_reference: checked.reference,
      filed_by_name: actor.name, filed_by_email: actor.email, filed_at: now, filed_summary: summary,
      reopened_by_name: null, reopened_at: null, reopen_reason: null, history, updated_at: now,
    }, { merge: true });
    return { kind: "filed" as const };
  });
}

/** Management opens a filed month again, for a correction the tax office has agreed to. */
export async function reopenVatPeriod(context: KcplStaffContext, year: number, month: number, reason: unknown, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!permissions(context).can_reopen) return { kind: "forbidden" as const };
  if (!vatReopenReasonValid(reason)) return { kind: "reason_required" as const };
  const why = (reason as string).trim().slice(0, 500);
  const db = firebaseAdminDb();
  const ref = db.collection(VAT_PERIODS).doc(vatPeriodId(year, month));
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists || doc.get("status") !== "filed") return { kind: "not_filed" as const };
    const now = new Date().toISOString();
    const history = [...historyFrom(doc.get("history")), { action: "reopened" as const, at: now, by: actor.name, detail: why }].slice(-40);
    transaction.update(ref, { status: "reopened", reopened_by_name: actor.name, reopened_by_email: actor.email, reopened_at: now, reopen_reason: why, history, updated_at: now });
    return { kind: "reopened" as const };
  });
}
