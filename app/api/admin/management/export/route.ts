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
  lines.push(row(["Range", analytics.range.label]));
  lines.push("");

  lines.push(row(["EXECUTIVE OPERATIONS"]));
  lines.push(row(["Metric", "Value"]));
  lines.push(row(["Active shipments", analytics.active_shipments]));
  lines.push(row(["Delivered in range", analytics.delivered_in_period]));
  lines.push(row(["Urgent shipments", analytics.urgent_shipments]));
  lines.push(row(["Exception shipments", analytics.exception_shipments]));
  lines.push(row(["Customs blocked shipments", analytics.customs_blocked_shipments]));
  lines.push(row(["Unassigned shipments", analytics.unassigned_shipments]));
  lines.push(row(["Quotes created", analytics.quote_total]));
  lines.push(row(["Quotes won", analytics.quote_won]));
  lines.push(row(["Quotes lost", analytics.quote_lost]));
  lines.push(row(["Quote won rate %", analytics.quote_conversion_percent]));
  lines.push("");

  lines.push(row(["FINANCIALS BY CURRENCY"]));
  lines.push(row(["Currency", "Revenue", "Cost", "Gross profit", "Margin %", "Open AR", "Overdue AR", "Open AP", "Overdue AP", "Invoices", "Cost items"]));
  for (const item of analytics.financials) lines.push(row([item.currency, item.revenue, item.cost, item.profit, item.margin_percent, item.receivables, item.overdue_receivables, item.payables, item.overdue_payables, item.invoice_count, item.cost_item_count]));
  lines.push("");

  lines.push(row(["BRANCH PERFORMANCE"]));
  lines.push(row(["Branch", "Currency", "Revenue", "Cost", "Gross profit", "Margin %", "Active jobs", "Invoices"]));
  for (const item of analytics.branches) lines.push(row([item.branch, item.currency, item.revenue, item.cost, item.profit, item.margin_percent, item.active_jobs, item.invoice_count]));
  lines.push("");

  lines.push(row(["CUSTOMER PROFITABILITY"]));
  lines.push(row(["Customer ref", "Customer", "Currency", "Revenue", "Cost", "Gross profit", "Margin %", "Invoices", "Shipments"]));
  for (const item of analytics.customers) lines.push(row([item.customer_id, item.customer_name, item.currency, item.revenue, item.cost, item.profit, item.margin_percent, item.invoice_count, item.shipment_count]));
  lines.push("");

  lines.push(row(["JOB PROFITABILITY"]));
  lines.push(row(["Shipment", "Customer", "Branch", "Origin", "Destination", "Mode", "Status", "Currency", "Revenue", "Cost", "Gross profit", "Margin %"]));
  for (const item of analytics.jobs) lines.push(row([item.shipment_reference, item.customer_name, item.branch, item.origin, item.destination, item.mode, item.status, item.currency, item.revenue, item.cost, item.profit, item.margin_percent]));
  lines.push("");

  lines.push(row(["ROUTE PERFORMANCE"]));
  lines.push(row(["Origin", "Destination", "Mode", "Currency", "Jobs", "Revenue", "Cost", "Gross profit", "Margin %"]));
  for (const item of analytics.routes) lines.push(row([item.origin, item.destination, item.mode, item.currency, item.jobs, item.revenue, item.cost, item.profit, item.margin_percent]));
  lines.push("");

  lines.push(row(["CUSTOMER CONCENTRATION"]));
  lines.push(row(["Currency", "Total revenue", "Top customer", "Top customer share %", "Top five share %"]));
  for (const item of analytics.concentration) lines.push(row([item.currency, item.total_revenue, item.top_customer_name, item.top_customer_share_percent, item.top_five_share_percent]));
  lines.push("");

  lines.push(row(["STAFF WORKLOAD"]));
  lines.push(row(["Staff", "Email", "Active jobs", "Urgent jobs", "Open tasks", "Overdue tasks"]));
  for (const item of analytics.staff_workload) lines.push(row([item.staff_name, item.staff_email, item.active_jobs, item.urgent_jobs, item.open_tasks, item.overdue_tasks]));
  lines.push("");

  lines.push(row(["MONTHLY TREND"]));
  lines.push(row(["Month", "Currency", "Revenue", "Cost", "Gross profit"]));
  for (const item of analytics.trends) lines.push(row([item.month, item.currency, item.revenue, item.cost, item.profit]));

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
