import { getAdminAccess } from "../../../../admin/admin-auth";
import { buildManagementAnalytics, resolveManagementRange } from "../../../../admin/management/management.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function row(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return Response.json({ ok: false, error: "Sign in is required." }, { status: 401 });
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return Response.json({ ok: false, error: "Management access is required." }, { status: 403 });

  const url = new URL(request.url);
  const range = resolveManagementRange(url.searchParams.get("range"), url.searchParams.get("from"), url.searchParams.get("to"));
  const analytics = await buildManagementAnalytics(range);
  if (!analytics) return Response.json({ ok: false, error: "Analytics are unavailable." }, { status: 503 });

  const lines: string[] = [];
  lines.push(row(["KCPL Management Analytics"]));
  lines.push(row(["Generated", analytics.generated_at]));
  lines.push(row(["Selected range", analytics.range.label]));
  lines.push(row(["Currency policy", "Currencies remain isolated; no FX aggregation"]));
  lines.push("");

  lines.push(row(["EXECUTIVE OPERATIONS"]));
  lines.push(row(["Metric", "Value", "Scope"]));
  lines.push(row(["Active shipments", analytics.active_shipments, "Live"]));
  lines.push(row(["Delivered", analytics.delivered_in_period, "Selected period"]));
  lines.push(row(["Urgent shipments", analytics.urgent_shipments, "Live"]));
  lines.push(row(["Exception shipments", analytics.exception_shipments, "Live"]));
  lines.push(row(["Customs blocked shipments", analytics.customs_blocked_shipments, "Live"]));
  lines.push(row(["Unassigned shipments", analytics.unassigned_shipments, "Live"]));
  lines.push(row(["Quotes created", analytics.quote_total, "Created in selected period"]));
  lines.push(row(["Quotes won", analytics.quote_won, "Selected-period creation cohort"]));
  lines.push(row(["Quotes lost", analytics.quote_lost, "Selected-period creation cohort"]));
  lines.push(row(["Quotes open", analytics.quote_open, "Selected-period creation cohort"]));
  lines.push(row(["Quotes decided", analytics.quote_decided, "Won + lost"]));
  lines.push(row(["Quote win rate %", analytics.quote_conversion_percent, "Won / decided"]));
  lines.push(row(["Quote decision rate %", analytics.quote_decision_rate_percent, "Decided / created"]));
  lines.push("");

  lines.push(row(["FINANCIALS BY CURRENCY"]));
  lines.push(row(["Currency", "Period revenue", "Period recognised cost", "Period gross profit", "Period margin %", "Live open AR", "Live overdue AR", "Live open AP", "Live overdue AP", "Period invoices", "Period cost items"]));
  for (const item of analytics.financials) lines.push(row([item.currency, item.revenue, item.cost, item.profit, item.margin_percent, item.receivables, item.overdue_receivables, item.payables, item.overdue_payables, item.invoice_count, item.cost_item_count]));
  lines.push("");

  lines.push(row(["BRANCH PERFORMANCE - SELECTED PERIOD"]));
  lines.push(row(["Branch", "Currency", "Revenue", "Cost", "Gross profit", "Margin %", "Live active jobs", "Period invoices"]));
  for (const item of analytics.branches) lines.push(row([item.branch, item.currency, item.revenue, item.cost, item.profit, item.margin_percent, item.active_jobs, item.invoice_count]));
  lines.push("");

  lines.push(row(["CUSTOMER PROFITABILITY - SELECTED PERIOD"]));
  lines.push(row(["Customer ref", "Customer", "Currency", "Revenue", "Cost", "Gross profit", "Margin %", "Invoices", "Shipments"]));
  for (const item of analytics.customers) lines.push(row([item.customer_id, item.customer_name, item.currency, item.revenue, item.cost, item.profit, item.margin_percent, item.invoice_count, item.shipment_count]));
  lines.push("");

  lines.push(row(["JOB PROFITABILITY - LIFETIME ECONOMICS FOR PERIOD COHORT"]));
  lines.push(row(["Shipment", "Customer", "Branch", "Origin", "Destination", "Mode", "Status", "Currency", "Lifetime revenue", "Lifetime cost", "Lifetime gross profit", "Lifetime margin %", "Period revenue", "Period cost", "Period gross profit", "Period margin %"]));
  for (const item of analytics.jobs) lines.push(row([item.shipment_reference, item.customer_name, item.branch, item.origin, item.destination, item.mode, item.status, item.currency, item.revenue, item.cost, item.profit, item.margin_percent, item.period_revenue, item.period_cost, item.period_profit, item.period_margin_percent]));
  lines.push("");

  lines.push(row(["ROUTE PERFORMANCE - SELECTED PERIOD"]));
  lines.push(row(["Origin", "Destination", "Mode", "Currency", "Jobs", "Revenue", "Cost", "Gross profit", "Margin %"]));
  for (const item of analytics.routes) lines.push(row([item.origin, item.destination, item.mode, item.currency, item.jobs, item.revenue, item.cost, item.profit, item.margin_percent]));
  lines.push("");

  lines.push(row(["CUSTOMER CONCENTRATION - SELECTED PERIOD"]));
  lines.push(row(["Currency", "Total revenue", "Top customer", "Top customer share %", "Top five share %"]));
  for (const item of analytics.concentration) lines.push(row([item.currency, item.total_revenue, item.top_customer_name, item.top_customer_share_percent, item.top_five_share_percent]));
  lines.push("");

  lines.push(row(["STAFF WORKLOAD - LIVE"]));
  lines.push(row(["Staff", "Email", "Active jobs", "Urgent jobs", "Open tasks", "Overdue tasks"]));
  for (const item of analytics.staff_workload) lines.push(row([item.staff_name, item.staff_email, item.active_jobs, item.urgent_jobs, item.open_tasks, item.overdue_tasks]));
  lines.push("");

  lines.push(row(["ROLLING 12-MONTH TREND"]));
  lines.push(row(["Month", "Currency", "Revenue", "Recognised cost", "Gross profit"]));
  for (const item of analytics.trends) lines.push(row([item.month, item.currency, item.revenue, item.cost, item.profit]));
  lines.push("");

  lines.push(row(["REPORTING DATA QUALITY"]));
  lines.push(row(["Metric", "Value"]));
  lines.push(row(["Excluded unsupported-currency records", analytics.data_quality.excluded_currency_records]));
  lines.push(row(["Unsupported currency values", analytics.data_quality.excluded_currency_values.join(" | ")]));
  lines.push(row(["Period financial records with unassigned branch", analytics.data_quality.unassigned_branch_financial_records]));
  lines.push(row(["Live active shipments with unassigned branch", analytics.data_quality.active_unassigned_branch_shipments]));
  lines.push(row(["Period invoices without shipment link", analytics.data_quality.unlinked_invoice_records]));
  lines.push(row(["Period job costs without loaded shipment", analytics.data_quality.orphaned_job_cost_records]));

  const filenameRange = analytics.range.key === "custom" ? `${analytics.range.from}-${analytics.range.to}` : analytics.range.key;
  return new Response(`\uFEFF${lines.join("\n")}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kcpl-management-${filenameRange}.csv"`,
      "cache-control": "no-store",
    },
  });
}
