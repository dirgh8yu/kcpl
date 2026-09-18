import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { mockFinanceSnapshot, overviewMockEnabled } from "./overview-mock";

export type OverviewFinanceTrendPoint = {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
};

export type OverviewFinanceCurrency = {
  currency: CrmCurrency;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number | null;
  revenue_change_percent: number | null;
  cost_change_percent: number | null;
  profit_change_percent: number | null;
  margin_change_points: number | null;
  trend: OverviewFinanceTrendPoint[];
};

export type OverviewFinanceSnapshot = {
  generated_at: string;
  period_label: string;
  currencies: OverviewFinanceCurrency[];
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyValue(value: unknown): CrmCurrency | null {
  const normalized = text(value).trim().toUpperCase();
  return crmCurrencies.includes(normalized as CrmCurrency) ? normalized as CrmCurrency : null;
}

function nepalDate(date = new Date()) {
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

function previousMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function percentageChange(current: number, previous: number) {
  if (Math.abs(previous) < 0.00001) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 10_000) / 100;
}

function marginPercent(revenue: number, profit: number) {
  if (Math.abs(revenue) < 0.00001) return null;
  return Math.round((profit / revenue) * 10_000) / 100;
}

function shipmentReferenceFromCost(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

type Bucket = {
  revenue: number;
  cost: number;
  previousRevenue: number;
  previousCost: number;
  daily: Map<string, { revenue: number; cost: number }>;
};

function bucketFor(map: Map<CrmCurrency, Bucket>, currency: CrmCurrency) {
  let bucket = map.get(currency);
  if (!bucket) {
    bucket = { revenue: 0, cost: 0, previousRevenue: 0, previousCost: 0, daily: new Map() };
    map.set(currency, bucket);
  }
  return bucket;
}

function addDaily(bucket: Bucket, date: string, kind: "revenue" | "cost", amount: number) {
  const row = bucket.daily.get(date) ?? { revenue: 0, cost: 0 };
  row[kind] += amount;
  bucket.daily.set(date, row);
}

export async function getOverviewFinanceSnapshot(staff: KcplStaffContext): Promise<OverviewFinanceSnapshot | null> {
  if (overviewMockEnabled()) return staff.permissions.canManageFinance ? mockFinanceSnapshot() : null;
  if (!firebaseRuntimeConfigured() || !staff.permissions.canManageFinance) return null;
  const db = firebaseAdminDb();
  const [invoices, costs, shipments] = await Promise.all([
    db.collection("invoices").limit(6000).get(),
    db.collectionGroup("job_costs").limit(15000).get(),
    db.collection("shipments").limit(5000).get(),
  ]);

  const today = nepalDate();
  const currentMonth = today.slice(0, 7);
  const previous = previousMonth(currentMonth);
  const shipmentMap = new Map(shipments.docs.map((doc) => [doc.id, doc]));
  const buckets = new Map<CrmCurrency, Bucket>();

  for (const doc of invoices.docs) {
    const data = doc.data() as Record<string, unknown>;
    const status = text(data.status);
    if (status === "draft" || status === "void") continue;
    if (text(data.record_type ?? data.migration_record_type) === "opening_balance") continue;
    if (!staffCanAccessBranch(staff, text(data.branch))) continue;
    const currency = currencyValue(data.currency);
    if (!currency) continue;
    const issueDate = text(data.issue_date).slice(0, 10);
    const month = issueDate.slice(0, 7);
    const amount = numberValue(data.total);
    const bucket = bucketFor(buckets, currency);
    if (month === currentMonth) {
      bucket.revenue += amount;
      addDaily(bucket, issueDate, "revenue", amount);
    } else if (month === previous) {
      bucket.previousRevenue += amount;
    }
  }

  for (const doc of costs.docs) {
    const reference = shipmentReferenceFromCost(doc.ref);
    const shipment = reference ? shipmentMap.get(reference) : null;
    if (!shipment?.exists || !staffCanAccessBranch(staff, text(shipment.get("primary_branch")))) continue;
    const data = doc.data() as Record<string, unknown>;
    const currency = currencyValue(data.currency);
    if (!currency) continue;
    const createdAt = text(data.created_at).slice(0, 10);
    const month = createdAt.slice(0, 7);
    const amount = numberValue(data.amount);
    const bucket = bucketFor(buckets, currency);
    if (month === currentMonth) {
      bucket.cost += amount;
      addDaily(bucket, createdAt, "cost", amount);
    } else if (month === previous) {
      bucket.previousCost += amount;
    }
  }

  const days = Number(today.slice(8, 10));
  const currencies = [...buckets.entries()].map(([currency, bucket]) => {
    const profit = bucket.revenue - bucket.cost;
    const previousProfit = bucket.previousRevenue - bucket.previousCost;
    const margin = marginPercent(bucket.revenue, profit);
    const previousMargin = marginPercent(bucket.previousRevenue, previousProfit);
    const trend = Array.from({ length: Math.max(days, 1) }, (_, index) => {
      const date = `${currentMonth}-${String(index + 1).padStart(2, "0")}`;
      const row = bucket.daily.get(date) ?? { revenue: 0, cost: 0 };
      return { date, revenue: row.revenue, cost: row.cost, profit: row.revenue - row.cost };
    });
    return {
      currency,
      revenue: bucket.revenue,
      cost: bucket.cost,
      profit,
      margin_percent: margin,
      revenue_change_percent: percentageChange(bucket.revenue, bucket.previousRevenue),
      cost_change_percent: percentageChange(bucket.cost, bucket.previousCost),
      profit_change_percent: percentageChange(profit, previousProfit),
      margin_change_points: margin !== null && previousMargin !== null ? Math.round((margin - previousMargin) * 100) / 100 : null,
      trend,
    } satisfies OverviewFinanceCurrency;
  }).sort((a, b) => b.revenue - a.revenue || a.currency.localeCompare(b.currency));

  return {
    generated_at: new Date().toISOString(),
    period_label: "This month",
    currencies,
  };
}
