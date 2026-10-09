import { readAllDocuments } from "../firestore-scan";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { convertMoney, invoiceNetRevenue, jobCostCounts } from "../finance/money-basis";
import { loadNprRateTable } from "../finance/fx-rates.server";
import type { KcplStaffContext } from "../staff-directory.server";
import {
  commissionSettingsFrom,
  commissionSettingsFromInput,
  invoicePaidShare,
  managerMargins,
  type CommissionSettings,
  type ManagerMarginRow,
  type ManagerRef,
  type MarginInvoice,
  type MarginPeriod,
} from "./account-margin";

/*
 * Margin and commission by account manager. Management only: it shows every
 * manager's figures side by side, so no other role reaches it, here or in the
 * route that saves the rates.
 */

const SETTINGS = "finance_settings";
const SETTINGS_DOC = "commission";

type Actor = { name: string; email: string };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadCommissionSettings(): Promise<CommissionSettings> {
  const doc = await firebaseAdminDb().collection(SETTINGS).doc(SETTINGS_DOC).get();
  return commissionSettingsFrom(doc.exists ? doc.data() : null);
}

export type AccountMarginReport = {
  period: MarginPeriod;
  rows: ManagerMarginRow[];
  totals: { revenue: number; cost: number; margin: number; commission: number; invoices: number };
  settings: CommissionSettings;
  /** Everyone who manages a customer now, for the rate form. */
  managers: Array<{ uid: string; name: string }>;
  /** Currencies with no NRB rate: their invoices and costs are left out. */
  unconverted: string[];
  rate_date: string | null;
  complete: boolean;
};

export async function loadAccountMargins(context: KcplStaffContext, period: MarginPeriod) {
  if (context.permissions.role !== "management") return { kind: "forbidden" as const };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const [invoices, customers, shipments, costs, settings, rateTable] = await Promise.all([
    readAllDocuments(db.collection("invoices")),
    readAllDocuments(db.collection("customers")),
    readAllDocuments(db.collection("shipments")),
    readAllDocuments(db.collectionGroup("job_costs")),
    loadCommissionSettings(),
    loadNprRateTable(),
  ]);
  const rates = rateTable?.rates ?? null;
  const unconverted = new Set<string>();
  const npr = (amount: number, currency: unknown) => {
    const code = text(currency).toUpperCase() || "NPR";
    const value = convertMoney(amount, code, "NPR", rates);
    if (value === null) unconverted.add(code);
    return value;
  };

  const customerById = new Map(customers.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const shipmentCustomer = new Map(shipments.docs.map((doc) => [doc.id, text((doc.data() as Record<string, unknown>).customer_id)]));
  const managers = new Map<string, string>();
  for (const [, data] of customerById) {
    const uid = text(data.account_manager_uid);
    if (uid) managers.set(uid, text(data.account_manager_name) || text(data.account_manager_email) || "Account manager");
  }

  // Revenue over each shipment's whole life, so its cost can be shared across its invoices.
  const shipmentRevenue = new Map<string, number>();
  const inPeriod: MarginInvoice[] = [];
  for (const doc of invoices.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (["draft", "void"].includes(text(data.status))) continue;
    if (data.record_type === "opening_balance" || data.migration_record_type === "opening_balance") continue;
    const revenue = npr(invoiceNetRevenue(data), data.currency);
    if (revenue === null) continue;
    const shipmentReference = text(data.shipment_reference) || null;
    if (shipmentReference) shipmentRevenue.set(shipmentReference, (shipmentRevenue.get(shipmentReference) ?? 0) + revenue);
    const issued = text(data.issue_date).slice(0, 10);
    if (!issued || issued < period.start || issued > period.end) continue;
    const customerId = text(data.customer_id) || (shipmentReference ? shipmentCustomer.get(shipmentReference) || null : null);
    inPeriod.push({
      reference: doc.id,
      number: text(data.tax_invoice_number) || text(data.external_invoice_number) || doc.id,
      customer_id: customerId,
      customer_name: text(data.customer_name) || text(customerById.get(customerId ?? "")?.display_name) || "Customer",
      shipment_reference: shipmentReference,
      revenue_npr: revenue,
      paid_share: invoicePaidShare(numberValue(data.total), numberValue(data.balance_due)),
    });
  }

  const shipmentCost = new Map<string, number>();
  for (const doc of costs.docs) {
    const data = doc.data() as Record<string, unknown>;
    const shipmentReference = doc.ref.parent.parent?.id ?? "";
    if (!shipmentReference || !jobCostCounts(data)) continue;
    const cost = npr(numberValue(data.amount), data.currency);
    if (cost !== null) shipmentCost.set(shipmentReference, (shipmentCost.get(shipmentReference) ?? 0) + cost);
  }

  const managerOf = (customerId: string | null): ManagerRef => {
    const customer = customerId ? customerById.get(customerId) : undefined;
    const uid = text(customer?.account_manager_uid);
    return uid ? { uid, name: managers.get(uid) ?? "Account manager" } : { uid: null, name: "No account manager" };
  };
  const rows = managerMargins({ invoices: inPeriod, shipmentCost, shipmentRevenue, managerOf, settings });
  const sum = (pick: (row: ManagerMarginRow) => number) => Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100;
  const report: AccountMarginReport = {
    period,
    rows,
    totals: { revenue: sum((row) => row.revenue), cost: sum((row) => row.cost), margin: sum((row) => row.margin), commission: sum((row) => row.commission), invoices: rows.reduce((total, row) => total + row.invoices, 0) },
    settings,
    managers: [...managers].map(([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name)),
    unconverted: [...unconverted].sort(),
    rate_date: rateTable?.date ?? null,
    complete: [invoices, customers, shipments, costs].every((scan) => scan.complete),
  };
  return { kind: "ready" as const, report };
}

export async function saveCommissionSettings(raw: Record<string, unknown>, actor: Actor, context: KcplStaffContext) {
  if (context.permissions.role !== "management") return { kind: "forbidden" as const };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const parsed = commissionSettingsFromInput(raw);
  if (!parsed.ok) return { kind: "invalid" as const, error: parsed.error };
  await firebaseAdminDb().collection(SETTINGS).doc(SETTINGS_DOC).set({ ...parsed.settings, updated_by_name: actor.name, updated_by_email: actor.email, updated_at: new Date().toISOString() });
  return { kind: "updated" as const, settings: parsed.settings };
}
