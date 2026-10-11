import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { nepalOperationalDate } from "../../invoice-effective-status";
import { adToBs } from "../../nepali-calendar";
import { CONTAINER_DEPOSITS, depositFromRecord, depositRefundDue } from "../../container-deposits";
import { readShipmentContainers } from "../../shipment-containers.server";
import { canAccessBranchValue } from "../branch-access-policy";
import { readAllDocuments } from "../firestore-scan";
import { qaMockDataEnabled } from "../qa-fixtures";
import type { KcplStaffContext } from "../staff-directory.server";
import { bankBalances } from "./bank-statement.server";
import { cashFlowByCurrency, type CashFlowCurrency, type CashFlowEntry } from "./cash-flow";
import { CUSTOMER_REFUNDS } from "./customer-credit-ledger.server";
import { loadTaxMonth } from "./tax-books.server";
import { WITHHELD_TAX } from "./withheld-tax-ledger.server";
import { tdsDepositDue } from "./withheld-tax-policy";

/*
 * What the cash-flow view reads: every open invoice and approved bill, the
 * container deposits claimed back, the refunds approved and not yet paid, TDS
 * to deposit and VAT to pay, and the bank balances from the latest statements
 * uploaded.
 */

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function num(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export type CashFlowOverview = {
  today: string;
  currencies: CashFlowCurrency[];
  entries: CashFlowEntry[];
  accounts: Array<{ account: string; currency: string; balance: number | null; as_of: string }>;
  /** The viewer sees only some branches, so the picture is partial and VAT is left out. */
  partial: boolean;
};

/** VAT for a Nepali month, due by the 25th of the next, while that date is still ahead. */
async function vatEntries(context: KcplStaffContext, today: string): Promise<CashFlowEntry[]> {
  const bs = adToBs(today);
  if (!bs || !context.can_access_all_branches) return [];
  const previous = bs.month === 1 ? { year: bs.year - 1, month: 12 } : { year: bs.year, month: bs.month - 1 };
  const months = await Promise.all([previous, { year: bs.year, month: bs.month }].map((month) => loadTaxMonth(context, month.year, month.month)));
  const entries: CashFlowEntry[] = [];
  for (const result of months) {
    if (result.kind !== "ready") continue;
    const due = tdsDepositDue(result.month.start);
    if (!due || due < today || result.month.summary.net_vat <= 0) continue;
    entries.push({
      kind: "vat", direction: "out", currency: "NPR", amount: result.month.summary.net_vat, date: due,
      label: `VAT for ${result.month.label}${result.month.end >= today ? ", so far" : ""}`, link: `/admin/finance/tax?y=${result.month.year}&m=${result.month.month}`,
    });
  }
  return entries;
}

export async function loadCashFlow(context: KcplStaffContext): Promise<{ kind: "ready"; overview: CashFlowOverview } | { kind: "forbidden" } | { kind: "unavailable" }> {
  if (!context.permissions.canManageFinance) return { kind: "forbidden" };
  const today = nepalOperationalDate();
  const partial = !context.can_access_all_branches;
  if (qaMockDataEnabled()) return { kind: "ready", overview: { today, currencies: cashFlowByCurrency([], today, []), entries: [], accounts: [], partial } };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const seen = (branch: unknown) => canAccessBranchValue(context, branch);
    const [invoices, deposits, bills, refunds, tds, accounts, vat] = await Promise.all([
      readAllDocuments(db.collection("invoices").where("status", "in", ["issued", "partially_paid", "overdue"])),
      readAllDocuments(db.collection(CONTAINER_DEPOSITS).where("status", "==", "claimed")),
      readAllDocuments(db.collection("payables").where("status", "in", ["approved", "partially_paid", "overdue"])),
      readAllDocuments(db.collection(CUSTOMER_REFUNDS).where("status", "==", "approved")),
      readAllDocuments(db.collection(WITHHELD_TAX).where("direction", "==", "by_kcpl").where("status", "==", "to_deposit")),
      bankBalances(),
      vatEntries(context, today),
    ]);
    const entries: CashFlowEntry[] = [];
    for (const doc of invoices.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!seen(data.branch) || num(data.balance_due) <= 0) continue;
      entries.push({
        kind: "invoice", direction: "in", currency: text(data.currency, "NPR"), amount: num(data.balance_due),
        date: text(data.due_date) || text(data.issue_date) || null,
        label: `${text(data.customer_name, "Customer")} · ${text(data.tax_invoice_number) || text(data.external_invoice_number) || doc.id}`,
        link: `/admin/finance/invoices/${encodeURIComponent(doc.id)}`,
      });
    }
    const claimed = deposits.docs.map((doc) => depositFromRecord(doc.id, doc.data() as Record<string, unknown>)).filter((deposit) => deposit.paid_by === "kcpl" && seen(deposit.branch));
    const references = [...new Set(claimed.map((deposit) => deposit.shipment_reference))];
    const lists = await Promise.all(references.map((reference) => readShipmentContainers(reference)));
    const boxes = new Map(references.map((reference, index) => [reference, lists[index] ?? []]));
    for (const deposit of claimed) {
      const due = depositRefundDue(deposit, boxes.get(deposit.shipment_reference) ?? [], today);
      if (!due) continue;
      entries.push({
        kind: "deposit", direction: "in", currency: deposit.currency, amount: due.amount, date: due.date,
        label: `Deposit back from ${deposit.shipping_line} · ${deposit.shipment_reference}`,
        link: `/admin/jobs/${encodeURIComponent(deposit.shipment_reference)}?step=transit#shipment-deposits`,
      });
    }
    for (const doc of bills.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!seen(data.branch) || num(data.balance_due) <= 0) continue;
      entries.push({
        kind: "bill", direction: "out", currency: text(data.currency, "NPR"), amount: num(data.balance_due),
        date: text(data.due_date) || text(data.bill_date) || null,
        label: `${text(data.supplier_name, "Supplier")}${text(data.supplier_bill_reference) ? ` · ${text(data.supplier_bill_reference)}` : ""}`,
        link: `/admin/payables/bills/${encodeURIComponent(doc.id)}`,
      });
    }
    for (const doc of refunds.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!seen(data.branch)) continue;
      entries.push({
        kind: "refund", direction: "out", currency: text(data.currency, "NPR"), amount: num(data.amount), date: null,
        label: `Refund to ${text(data.customer_name, "customer")}`, link: `/admin/finance/credits/${encodeURIComponent(text(data.credit_id))}`,
      });
    }
    for (const doc of tds.docs) {
      const data = doc.data() as Record<string, unknown>;
      if (!seen(data.branch)) continue;
      entries.push({
        kind: "tds", direction: "out", currency: text(data.currency, "NPR"), amount: num(data.amount), date: text(data.deposit_due) || null,
        label: `TDS withheld from ${text(data.counterparty_name, "a supplier")}`, link: "/admin/finance/tax",
      });
    }
    entries.push(...vat);
    const openings = accounts.filter((account) => account.balance !== null).map((account) => ({ currency: account.currency, balance: account.balance as number }));
    return { kind: "ready", overview: { today, currencies: cashFlowByCurrency(entries, today, openings), entries: entries.sort((a, b) => (a.date ?? today).localeCompare(b.date ?? today)), accounts, partial } };
  } catch (error) {
    console.error("KCPL cash flow failed", error);
    return { kind: "unavailable" };
  }
}
