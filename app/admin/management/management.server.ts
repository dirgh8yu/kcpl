import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { managementRangeKeys, type BranchPerformance, type ConcentrationRisk, type CurrencyFinancialMetric, type CustomerPerformance, type JobPerformance, type ManagementAnalytics, type ManagementRange, type ManagementRangeKey, type RoutePerformance, type StaffWorkload, type TrendPoint } from "./management-data";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyValue(value: unknown): CrmCurrency | null {
  const normalized = text(value).trim().toUpperCase();
  return crmCurrencies.includes(normalized as CrmCurrency) ? normalized as CrmCurrency : null;
}

function branchValue(value: unknown): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : "Kathmandu";
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function yearStart(date: string) {
  return `${date.slice(0, 4)}-01-01`;
}

function quarterStart(date: string) {
  const [year, month] = date.split("-").map(Number);
  const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${String(startMonth).padStart(2, "0")}-01`;
}

function safeDate(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function resolveManagementRange(keyInput?: string | null, fromInput?: string | null, toInput?: string | null): ManagementRange {
  const today = operationalDate();
  const key = managementRangeKeys.includes(keyInput as ManagementRangeKey) ? keyInput as ManagementRangeKey : "month";
  if (key === "today") return { key, label: "Today", from: today, to: today };
  if (key === "7d") return { key, label: "Last 7 days", from: addDays(today, -6), to: today };
  if (key === "month") return { key, label: "This month", from: monthStart(today), to: today };
  if (key === "quarter") return { key, label: "This quarter", from: quarterStart(today), to: today };
  if (key === "year") return { key, label: "This year", from: yearStart(today), to: today };
  if (key === "all") return { key, label: "All time", from: null, to: null };
  const from = safeDate(fromInput) ?? monthStart(today);
  const to = safeDate(toInput) ?? today;
  const normalizedFrom = from <= to ? from : to;
  const normalizedTo = from <= to ? to : from;
  return { key: "custom", label: `${normalizedFrom} to ${normalizedTo}`, from: normalizedFrom, to: normalizedTo };
}

function datePart(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function inRange(value: unknown, range: ManagementRange) {
  if (!range.from || !range.to) return true;
  const date = datePart(value);
  return Boolean(date && date >= range.from && date <= range.to);
}

function monthKey(value: unknown) {
  const date = datePart(value);
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

function margin(revenue: number, profit: number) {
  return revenue > 0.00001 ? Math.round((profit / revenue) * 10000) / 100 : null;
}

function shipmentIdFromChild(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

type MutableMoney = { revenue: number; cost: number; invoiceCount: number; costCount: number };
type MutableCustomer = MutableMoney & { customerId: string; customerName: string; currency: CrmCurrency; shipments: Set<string> };
type MutableJob = MutableMoney & { shipmentReference: string; customerId: string | null; customerName: string; branch: KcplBranch; origin: string; destination: string; mode: string; status: string; currency: CrmCurrency };

function moneyKey(...values: string[]) {
  return values.join("::");
}

function ensureMoney(map: Map<string, MutableMoney>, key: string) {
  let value = map.get(key);
  if (!value) {
    value = { revenue: 0, cost: 0, invoiceCount: 0, costCount: 0 };
    map.set(key, value);
  }
  return value;
}

export async function buildManagementAnalytics(range: ManagementRange): Promise<ManagementAnalytics | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const [invoicesSnapshot, payablesSnapshot, shipmentsSnapshot, quotesSnapshot, customersSnapshot, costsSnapshot, tasksSnapshot, customsSnapshot] = await Promise.all([
    db.collection("invoices").limit(6000).get(),
    db.collection("payables").limit(6000).get(),
    db.collection("shipments").limit(5000).get(),
    db.collection("quotes").limit(6000).get(),
    db.collection("customers").limit(5000).get(),
    db.collectionGroup("job_costs").limit(15000).get(),
    db.collectionGroup("job_tasks").limit(15000).get(),
    db.collectionGroup("customs_steps").limit(10000).get(),
  ]);

  const today = operationalDate();
  const nowMs = Date.now();
  const customers = new Map(customersSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const quotes = new Map(quotesSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const shipments = new Map(shipmentsSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));

  let excludedCurrencyRecords = 0;
  const excludedCurrencyValues = new Set<string>();
  function financialCurrency(value: unknown) {
    const currency = currencyValue(value);
    if (currency) return currency;
    excludedCurrencyRecords += 1;
    excludedCurrencyValues.add(text(value).trim().toUpperCase() || "MISSING");
    return null;
  }

  const currentFinancials = new Map<CrmCurrency, CurrencyFinancialMetric>();
  function current(currency: CrmCurrency) {
    let row = currentFinancials.get(currency);
    if (!row) {
      row = { currency, revenue: 0, cost: 0, profit: 0, margin_percent: null, receivables: 0, overdue_receivables: 0, payables: 0, overdue_payables: 0, invoice_count: 0, cost_item_count: 0 };
      currentFinancials.set(currency, row);
    }
    return row;
  }

  const branchMoney = new Map<string, MutableMoney>();
  const customerMoney = new Map<string, MutableCustomer>();
  const jobMoney = new Map<string, MutableJob>();
  const trendMoney = new Map<string, { month: string; currency: CrmCurrency; revenue: number; cost: number }>();

  function jobMeta(shipmentReference: string, currency: CrmCurrency): MutableJob {
    const key = moneyKey(shipmentReference, currency);
    let row = jobMoney.get(key);
    if (row) return row;
    const shipment = shipments.get(shipmentReference) ?? {};
    const quoteRef = text(shipment.quote_reference);
    const quote = quotes.get(quoteRef) ?? {};
    const customerId = nullable(shipment.customer_id) ?? nullable(quote.customer_id);
    const customer = customerId ? customers.get(customerId) : undefined;
    row = {
      shipmentReference,
      customerId,
      customerName: text(customer?.display_name, text(quote.company_name, text(quote.contact_name, customerId ?? "Unlinked customer"))),
      branch: branchValue(shipment.primary_branch ?? customer?.primary_branch),
      origin: text(quote.origin, "Origin"),
      destination: text(quote.destination, "Destination"),
      mode: text(quote.mode, "Not set"),
      status: text(shipment.status, "booking_confirmed"),
      currency,
      revenue: 0,
      cost: 0,
      invoiceCount: 0,
      costCount: 0,
    };
    jobMoney.set(key, row);
    return row;
  }

  for (const doc of invoicesSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const status = text(data.status);
    const currency = financialCurrency(data.currency);
    if (!currency) continue;
    const total = numberValue(data.total);
    const balance = Math.max(0, numberValue(data.balance_due));
    const due = datePart(data.due_date);
    if (!["draft", "void"].includes(status)) {
      const snapshot = current(currency);
      snapshot.receivables += balance;
      if (balance > 0 && due && due < today) snapshot.overdue_receivables += balance;
    }
    if (["draft", "void"].includes(status) || !inRange(data.issue_date, range)) continue;
    const snapshot = current(currency);
    snapshot.revenue += total;
    snapshot.invoice_count += 1;
    const branch = branchValue(data.branch);
    const branchRow = ensureMoney(branchMoney, moneyKey(branch, currency));
    branchRow.revenue += total;
    branchRow.invoiceCount += 1;
    const customerId = text(data.customer_id);
    const customerName = text(data.customer_name, customerId || "Customer");
    const customerKey = moneyKey(customerId || customerName, currency);
    let customerRow = customerMoney.get(customerKey);
    if (!customerRow) {
      customerRow = { customerId, customerName, currency, revenue: 0, cost: 0, invoiceCount: 0, costCount: 0, shipments: new Set<string>() };
      customerMoney.set(customerKey, customerRow);
    }
    customerRow.revenue += total;
    customerRow.invoiceCount += 1;
    const shipmentReference = text(data.shipment_reference);
    if (shipmentReference) {
      customerRow.shipments.add(shipmentReference);
      const job = jobMeta(shipmentReference, currency);
      job.revenue += total;
      job.invoiceCount += 1;
    }
    const month = monthKey(data.issue_date);
    if (month) {
      const trendKey = moneyKey(month, currency);
      let trend = trendMoney.get(trendKey);
      if (!trend) {
        trend = { month, currency, revenue: 0, cost: 0 };
        trendMoney.set(trendKey, trend);
      }
      trend.revenue += total;
    }
  }

  for (const doc of payablesSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const status = text(data.status);
    if (["draft", "void"].includes(status)) continue;
    const currency = financialCurrency(data.currency);
    if (!currency) continue;
    const balance = Math.max(0, numberValue(data.balance_due));
    const due = datePart(data.due_date);
    const snapshot = current(currency);
    snapshot.payables += balance;
    if (balance > 0 && due && due < today) snapshot.overdue_payables += balance;
  }

  for (const doc of costsSnapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (!inRange(data.created_at, range)) continue;
    const shipmentReference = shipmentIdFromChild(doc.ref);
    if (!shipmentReference) continue;
    const currency = financialCurrency(data.currency);
    if (!currency) continue;
    const amount = numberValue(data.amount);
    const shipment = shipments.get(shipmentReference) ?? {};
    const quote = quotes.get(text(shipment.quote_reference)) ?? {};
    const customerId = nullable(shipment.customer_id) ?? nullable(quote.customer_id) ?? "";
    const customer = customerId ? customers.get(customerId) : undefined;
    const customerName = text(customer?.display_name, text(quote.company_name, text(quote.contact_name, customerId || "Unlinked customer")));
    const branch = branchValue(shipment.primary_branch ?? customer?.primary_branch);
    const snapshot = current(currency);
    snapshot.cost += amount;
    snapshot.cost_item_count += 1;
    const branchRow = ensureMoney(branchMoney, moneyKey(branch, currency));
    branchRow.cost += amount;
    branchRow.costCount += 1;
    const customerKey = moneyKey(customerId || customerName, currency);
    let customerRow = customerMoney.get(customerKey);
    if (!customerRow) {
      customerRow = { customerId, customerName, currency, revenue: 0, cost: 0, invoiceCount: 0, costCount: 0, shipments: new Set<string>() };
      customerMoney.set(customerKey, customerRow);
    }
    customerRow.cost += amount;
    customerRow.costCount += 1;
    customerRow.shipments.add(shipmentReference);
    const job = jobMeta(shipmentReference, currency);
    job.cost += amount;
    job.costCount += 1;
    const month = monthKey(data.created_at);
    if (month) {
      const trendKey = moneyKey(month, currency);
      let trend = trendMoney.get(trendKey);
      if (!trend) {
        trend = { month, currency, revenue: 0, cost: 0 };
        trendMoney.set(trendKey, trend);
      }
      trend.cost += amount;
    }
  }

  const activeByBranch = new Map<KcplBranch, number>();
  let activeShipments = 0;
  let deliveredInPeriod = 0;
  let urgentShipments = 0;
  let exceptionShipments = 0;
  let unassignedShipments = 0;
  for (const [, data] of shipments) {
    const status = text(data.status);
    const branch = branchValue(data.primary_branch);
    if (status !== "delivered") {
      activeShipments += 1;
      activeByBranch.set(branch, (activeByBranch.get(branch) ?? 0) + 1);
      if (text(data.job_priority) === "urgent") urgentShipments += 1;
      if (status === "exception") exceptionShipments += 1;
      if (!nullable(data.job_assigned_to_email) && !nullable(data.job_assigned_to_name)) unassignedShipments += 1;
    } else if (inRange(data.updated_at ?? data.delivered_at ?? data.created_at, range)) {
      deliveredInPeriod += 1;
    }
  }

  const customsBlocked = new Set<string>();
  for (const doc of customsSnapshot.docs) {
    if (doc.get("required") === false || doc.get("completed") === true) continue;
    const shipmentReference = shipmentIdFromChild(doc.ref);
    if (shipmentReference && text(shipments.get(shipmentReference)?.status) !== "delivered") customsBlocked.add(shipmentReference);
  }

  const workloads = new Map<string, StaffWorkload>();
  function workload(name: string, email: string | null) {
    const key = (email || name || "Unassigned").toLowerCase();
    let row = workloads.get(key);
    if (!row) {
      row = { staff_name: name || "Unassigned", staff_email: email, active_jobs: 0, urgent_jobs: 0, open_tasks: 0, overdue_tasks: 0 };
      workloads.set(key, row);
    }
    return row;
  }

  for (const [, data] of shipments) {
    if (text(data.status) === "delivered") continue;
    const name = nullable(data.job_assigned_to_name) ?? "Unassigned";
    const email = nullable(data.job_assigned_to_email);
    const row = workload(name, email);
    row.active_jobs += 1;
    if (text(data.job_priority) === "urgent") row.urgent_jobs += 1;
  }

  for (const doc of tasksSnapshot.docs) {
    if (doc.get("completed") === true) continue;
    const name = nullable(doc.get("assigned_to_name")) ?? "Unassigned";
    const email = nullable(doc.get("assigned_to_email"));
    const row = workload(name, email);
    row.open_tasks += 1;
    const dueAt = nullable(doc.get("due_at"));
    if (dueAt) {
      const dueMs = new Date(dueAt).getTime();
      if (Number.isFinite(dueMs) && dueMs < nowMs) row.overdue_tasks += 1;
    }
  }

  let quoteTotal = 0;
  let quoteWon = 0;
  let quoteLost = 0;
  for (const [, data] of quotes) {
    if (!inRange(data.created_at, range)) continue;
    quoteTotal += 1;
    const status = text(data.status);
    if (status === "won") quoteWon += 1;
    if (status === "lost") quoteLost += 1;
  }

  const financials = [...currentFinancials.values()].map((row) => {
    row.profit = row.revenue - row.cost;
    row.margin_percent = margin(row.revenue, row.profit);
    return row;
  }).filter((row) => row.revenue || row.cost || row.receivables || row.payables).sort((a, b) => b.revenue - a.revenue || a.currency.localeCompare(b.currency));

  const branches: BranchPerformance[] = [];
  for (const [key, row] of branchMoney) {
    const [branchRaw, currencyRaw] = key.split("::");
    const currency = currencyValue(currencyRaw);
    if (!currency) continue;
    const branch = branchValue(branchRaw);
    const profit = row.revenue - row.cost;
    branches.push({ branch, currency, revenue: row.revenue, cost: row.cost, profit, margin_percent: margin(row.revenue, profit), active_jobs: activeByBranch.get(branch) ?? 0, invoice_count: row.invoiceCount });
  }
  for (const branch of kcplBranches) {
    if (branches.some((item) => item.branch === branch)) continue;
    branches.push({ branch, currency: "NPR", revenue: 0, cost: 0, profit: 0, margin_percent: null, active_jobs: activeByBranch.get(branch) ?? 0, invoice_count: 0 });
  }
  branches.sort((a, b) => a.currency.localeCompare(b.currency) || b.profit - a.profit || a.branch.localeCompare(b.branch));

  const customerRows: CustomerPerformance[] = [...customerMoney.values()].map((row) => {
    const profit = row.revenue - row.cost;
    return { customer_id: row.customerId, customer_name: row.customerName, currency: row.currency, revenue: row.revenue, cost: row.cost, profit, margin_percent: margin(row.revenue, profit), invoice_count: row.invoiceCount, shipment_count: row.shipments.size };
  }).filter((row) => row.revenue || row.cost).sort((a, b) => a.currency.localeCompare(b.currency) || b.profit - a.profit);

  const jobs: JobPerformance[] = [...jobMoney.values()].map((row) => {
    const profit = row.revenue - row.cost;
    return { shipment_reference: row.shipmentReference, customer_id: row.customerId, customer_name: row.customerName, branch: row.branch, origin: row.origin, destination: row.destination, mode: row.mode, status: row.status, currency: row.currency, revenue: row.revenue, cost: row.cost, profit, margin_percent: margin(row.revenue, profit) };
  }).filter((row) => row.revenue || row.cost).sort((a, b) => a.currency.localeCompare(b.currency) || b.profit - a.profit);

  const routeMap = new Map<string, { origin: string; destination: string; mode: string; currency: CrmCurrency; revenue: number; cost: number; jobs: Set<string> }>();
  for (const job of jobs) {
    const key = moneyKey(job.origin, job.destination, job.mode, job.currency);
    let route = routeMap.get(key);
    if (!route) {
      route = { origin: job.origin, destination: job.destination, mode: job.mode, currency: job.currency, revenue: 0, cost: 0, jobs: new Set<string>() };
      routeMap.set(key, route);
    }
    route.revenue += job.revenue;
    route.cost += job.cost;
    route.jobs.add(job.shipment_reference);
  }
  const routes: RoutePerformance[] = [...routeMap.values()].map((row) => {
    const profit = row.revenue - row.cost;
    return { origin: row.origin, destination: row.destination, mode: row.mode, currency: row.currency, revenue: row.revenue, cost: row.cost, profit, margin_percent: margin(row.revenue, profit), jobs: row.jobs.size };
  }).sort((a, b) => a.currency.localeCompare(b.currency) || b.profit - a.profit);

  const trends: TrendPoint[] = [...trendMoney.values()].map((row) => ({ month: row.month, currency: row.currency, revenue: row.revenue, cost: row.cost, profit: row.revenue - row.cost })).sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency));

  const concentration: ConcentrationRisk[] = [];
  for (const currency of crmCurrencies) {
    const rows = customerRows.filter((row) => row.currency === currency && row.revenue > 0).sort((a, b) => b.revenue - a.revenue);
    if (!rows.length) continue;
    const total = rows.reduce((sum, row) => sum + row.revenue, 0);
    const topFive = rows.slice(0, 5).reduce((sum, row) => sum + row.revenue, 0);
    concentration.push({ currency, total_revenue: total, top_customer_name: rows[0]?.customer_name ?? null, top_customer_share_percent: total ? Math.round((rows[0].revenue / total) * 10000) / 100 : 0, top_five_share_percent: total ? Math.round((topFive / total) * 10000) / 100 : 0 });
  }

  const staffWorkload = [...workloads.values()].filter((row) => row.active_jobs || row.open_tasks).sort((a, b) => (b.overdue_tasks * 5 + b.urgent_jobs * 4 + b.open_tasks + b.active_jobs) - (a.overdue_tasks * 5 + a.urgent_jobs * 4 + a.open_tasks + a.active_jobs)).slice(0, 25);
  const lossMakingJobs = jobs.filter((row) => row.profit < -0.00001).sort((a, b) => a.currency.localeCompare(b.currency) || a.profit - b.profit).slice(0, 50);

  if (excludedCurrencyRecords) {
    console.warn("KCPL Management Analytics excluded financial records with unsupported currency values", {
      count: excludedCurrencyRecords,
      values: [...excludedCurrencyValues].sort(),
    });
  }

  return {
    generated_at: new Date().toISOString(),
    range,
    financials,
    branches,
    customers: customerRows,
    jobs,
    loss_making_jobs: lossMakingJobs,
    routes,
    trends,
    concentration,
    staff_workload: staffWorkload,
    quote_total: quoteTotal,
    quote_won: quoteWon,
    quote_lost: quoteLost,
    quote_conversion_percent: quoteTotal ? Math.round((quoteWon / quoteTotal) * 10000) / 100 : 0,
    active_shipments: activeShipments,
    delivered_in_period: deliveredInPeriod,
    urgent_shipments: urgentShipments,
    exception_shipments: exceptionShipments,
    customs_blocked_shipments: customsBlocked.size,
    unassigned_shipments: unassignedShipments,
  };
}
