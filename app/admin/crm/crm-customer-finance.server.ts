import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "./crm-data";
import type { CrmCustomerFinanceSnapshot } from "./crm-customer-finance";

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function currencyValue(value: unknown): CrmCurrency {
  return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : "NPR";
}

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function isOpeningBalance(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  return snapshot.get("record_type") === "opening_balance" || snapshot.get("migration_record_type") === "opening_balance";
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function daysOverdue(dueDate: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(now) || due >= now) return null;
  return Math.max(1, Math.floor((now - due) / 86_400_000));
}

function canSeeBranch(context: KcplStaffContext, branch: KcplBranch | null) {
  if (!branch) return false;
  return context.can_access_all_branches || staffCanAccessBranch(context, branch);
}

export async function getCrmCustomerFinanceSnapshot(
  customerId: string,
  context: KcplStaffContext,
): Promise<CrmCustomerFinanceSnapshot | null | undefined> {
  if (!firebaseRuntimeConfigured()) return undefined;
  if (!context.permissions.canViewCommercial) return null;

  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();
  const customer = await db.collection("customers").doc(id).get();
  if (!customer.exists || customer.get("archived") === true) return null;

  const currency = currencyValue(customer.get("preferred_currency"));
  const today = operationalDate();
  const [invoiceSnapshot, shipmentSnapshot] = await Promise.all([
    db.collection("invoices").where("customer_id", "==", id).limit(2000).get(),
    db.collection("shipments").where("customer_id", "==", id).limit(500).get(),
  ]);

  let revenue = 0;
  let collected = 0;
  let outstanding = 0;
  let overdue = 0;
  let invoiceCount = 0;
  let openInvoiceCount = 0;
  let overdueInvoiceCount = 0;
  let draftInvoiceCount = 0;
  let oldestOverdueDays: number | null = null;
  let otherCurrencyInvoiceCount = 0;
  let integrityWarningCount = 0;

  for (const invoice of invoiceSnapshot.docs) {
    const branch = branchValue(invoice.get("branch"));
    if (!branch) {
      integrityWarningCount += 1;
      continue;
    }
    if (!canSeeBranch(context, branch)) continue;

    const status = text(invoice.get("status"), "draft");
    if (status === "draft") {
      draftInvoiceCount += 1;
      continue;
    }
    if (status === "void") continue;

    const invoiceCurrency = currencyValue(invoice.get("currency"));
    if (invoiceCurrency !== currency) {
      otherCurrencyInvoiceCount += 1;
      continue;
    }

    invoiceCount += 1;
    const total = Math.max(0, numberValue(invoice.get("total")));
    const paid = Math.max(0, numberValue(invoice.get("amount_paid")));
    const balance = Math.max(0, numberValue(invoice.get("balance_due")));
    if (!isOpeningBalance(invoice)) revenue += total;
    collected += paid;
    outstanding += balance;

    if (balance > 0) {
      openInvoiceCount += 1;
      const overdueDays = daysOverdue(text(invoice.get("due_date")), today);
      if (overdueDays !== null) {
        overdue += balance;
        overdueInvoiceCount += 1;
        oldestOverdueDays = oldestOverdueDays === null ? overdueDays : Math.max(oldestOverdueDays, overdueDays);
      }
    }
  }

  const accessibleShipments = shipmentSnapshot.docs.filter((shipment) => {
    const branch = branchValue(shipment.get("primary_branch"));
    if (!branch) {
      integrityWarningCount += 1;
      return false;
    }
    return canSeeBranch(context, branch);
  });

  let cost = 0;
  let otherCurrencyCostCount = 0;
  for (let index = 0; index < accessibleShipments.length; index += 25) {
    const batch = accessibleShipments.slice(index, index + 25);
    const costSnapshots = await Promise.all(
      batch.map((shipment) => shipment.ref.collection("job_costs").limit(1000).get()),
    );
    for (const costs of costSnapshots) {
      for (const item of costs.docs) {
        const itemCurrency = currencyValue(item.get("currency"));
        if (itemCurrency !== currency) {
          otherCurrencyCostCount += 1;
          continue;
        }
        cost += Math.max(0, numberValue(item.get("amount")));
      }
    }
  }

  const profit = revenue - cost;
  return {
    currency,
    revenue_total: revenue,
    cost_total: cost,
    profit_total: profit,
    gross_margin_percent: revenue > 0 ? (profit / revenue) * 100 : 0,
    collected_total: collected,
    outstanding_total: outstanding,
    overdue_total: overdue,
    invoice_count: invoiceCount,
    open_invoice_count: openInvoiceCount,
    overdue_invoice_count: overdueInvoiceCount,
    draft_invoice_count: draftInvoiceCount,
    oldest_overdue_days: oldestOverdueDays,
    other_currency_invoice_count: otherCurrencyInvoiceCount,
    other_currency_cost_count: otherCurrencyCostCount,
    integrity_warning_count: integrityWarningCount,
    generated_at: new Date().toISOString(),
  };
}
