import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Download,
  Landmark,
  PackageCheck,
  Scale,
  Target,
  UsersRound,
} from "lucide-react";
import type { ManagementAnalytics, ManagementRangeKey } from "./management-data";
import {
  OpsButton,
  OpsEmptyState,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
  OpsTableFrame,
} from "../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function number(value: number) {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(value);
}

function percentage(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

function queryFor(range: ManagementAnalytics["range"]) {
  const params = new URLSearchParams({ range: range.key });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  return params.toString();
}

const ranges: Array<{ key: ManagementRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
  { key: "all", label: "All time" },
];

export function ManagementWorkspace({ analytics }: { analytics: ManagementAnalytics }) {
  const exportQuery = queryFor(analytics.range);
  const topCustomers = analytics.customers.slice(0, 15);
  const topRoutes = analytics.routes.slice(0, 12);
  const lossJobs = analytics.loss_making_jobs.slice(0, 12);
  const workload = analytics.staff_workload.slice(0, 15);
  const quality = analytics.data_quality;
  const dataQualityCount = quality.excluded_currency_records + quality.unassigned_branch_financial_records + quality.active_unassigned_branch_shipments + quality.unlinked_invoice_records + quality.orphaned_job_cost_records;
  const managementPressure = analytics.urgent_shipments + analytics.exception_shipments + analytics.customs_blocked_shipments + analytics.unassigned_shipments + analytics.loss_making_jobs.length;

  return <main>
    <OpsPageHeader
      eyebrow="Management intelligence"
      title="Management Analytics"
      description="Selected-period performance, current working-capital exposure and live operational pressure. Currencies remain separate throughout."
      breadcrumbs={[{ label: "Finance" }, { label: "Management Analytics" }]}
      meta={<span>{analytics.range.label} · Generated {new Date(analytics.generated_at).toLocaleString("en-AU")}</span>}
      actions={<><OpsButton href={`/api/admin/management/export?${exportQuery}`}><Download size={13}/>Export CSV</OpsButton><OpsButton href="/admin/command-centre" tone="primary">Operations Home</OpsButton></>}
    />

    <div className="ops-page-body ops-stack">
      <OpsPanel title="Reporting range" eyebrow="Scope">
        <div className="flex flex-wrap items-end gap-2 p-3.5">
          <div className="flex flex-wrap gap-1.5">{ranges.map((item) => <Link key={item.key} href={`/admin/management?range=${item.key}`} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium ${analytics.range.key === item.key ? "border-[#d9def8] bg-[#f0f2ff] text-[#4655a0]" : "border-[#e0e3e7] bg-white text-[#6c747d] hover:bg-[#fafafa]"}`}>{item.label}</Link>)}</div>
          <form method="get" className="ml-auto flex flex-wrap items-end gap-2"><input type="hidden" name="range" value="custom"/><label><span className="mb-1 block text-[9px] font-medium text-[#7e868f]">From</span><input name="from" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.from ?? "" : ""} className="h-8 px-2.5 text-[11px]"/></label><label><span className="mb-1 block text-[9px] font-medium text-[#7e868f]">To</span><input name="to" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.to ?? "" : ""} className="h-8 px-2.5 text-[11px]"/></label><OpsButton type="submit">Apply</OpsButton></form>
        </div>
      </OpsPanel>

      <OpsMetricStrip columns={6}>
        <OpsMetric label="Active shipments" value={number(analytics.active_shipments)} icon={<Boxes size={13}/>}/>
        <OpsMetric label="Delivered" value={number(analytics.delivered_in_period)} icon={<PackageCheck size={13}/>} hint="Period"/>
        <OpsMetric label="Quote win rate" value={`${analytics.quote_conversion_percent.toFixed(1)}%`} icon={<Target size={13}/>} hint="Decided"/>
        <OpsMetric label="Urgent / exception" value={`${analytics.urgent_shipments} / ${analytics.exception_shipments}`} icon={<AlertTriangle size={13}/>} tone={analytics.urgent_shipments + analytics.exception_shipments ? "danger" : "success"}/>
        <OpsMetric label="Customs blocked" value={number(analytics.customs_blocked_shipments)} icon={<Scale size={13}/>} tone={analytics.customs_blocked_shipments ? "warning" : "success"}/>
        <OpsMetric label="Unassigned jobs" value={number(analytics.unassigned_shipments)} icon={<UsersRound size={13}/>} tone={analytics.unassigned_shipments ? "warning" : "success"}/>
      </OpsMetricStrip>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Pressure label="Management pressure" value={managementPressure} detail="Urgent, exception, customs, unassigned and loss-making signals" tone={managementPressure ? "danger" : "success"}/>
        <Pressure label="Quote decisions" value={`${analytics.quote_decided}/${analytics.quote_total}`} detail={`${analytics.quote_open} open · ${analytics.quote_decision_rate_percent.toFixed(1)}% decision rate`}/>
        <Pressure label="Loss-making jobs" value={analytics.loss_making_jobs.length} detail="Jobs financially touched in the selected period" tone={analytics.loss_making_jobs.length ? "danger" : "success"}/>
        <Pressure label="Data quality" value={dataQualityCount} detail={dataQualityCount ? "Records need reporting cleanup" : "No tracked integrity issues"} tone={dataQualityCount ? "warning" : "success"}/>
      </div>

      {dataQualityCount ? <div className="flex items-start gap-3 rounded-lg border border-[#eadfca] bg-[#fbf7ef] px-4 py-3 text-[11px] leading-5 text-[#765b31]"><AlertTriangle size={15} className="mt-0.5 shrink-0"/><div><strong className="font-semibold text-[#5b4728]">Reporting integrity flags</strong><p className="mt-1">Excluded currency records: {quality.excluded_currency_records}{quality.excluded_currency_values.length ? ` (${quality.excluded_currency_values.join(", ")})` : ""}. Unassigned branch financial records: {quality.unassigned_branch_financial_records}. Active unassigned shipments: {quality.active_unassigned_branch_shipments}. Unlinked invoices: {quality.unlinked_invoice_records}. Orphaned job costs: {quality.orphaned_job_cost_records}.</p></div></div> : null}

      <OpsPanel title="Period P&L and live working capital" eyebrow="Financials" description="Revenue and recognised job cost follow the selected range. AR and AP are current open balances.">
        {analytics.financials.length ? <div className="overflow-x-auto"><table className="ops-dense-table min-w-[980px]"><thead><tr><th className="px-4 text-left">Currency</th><th className="px-3 text-right">Revenue</th><th className="px-3 text-right">Cost</th><th className="px-3 text-right">Gross profit</th><th className="px-3 text-right">Margin</th><th className="px-3 text-right">AR open</th><th className="px-3 text-right">AR overdue</th><th className="px-3 text-right">AP open</th><th className="px-4 text-right">AP overdue</th></tr></thead><tbody>{analytics.financials.map((item) => <tr key={item.currency}><td className="px-4"><strong className="font-semibold">{item.currency}</strong><p className="mt-0.5 text-[9px] text-[#989fa6]">{item.invoice_count} invoices · {item.cost_item_count} costs</p></td><td className="px-3 text-right">{money(item.revenue, item.currency)}</td><td className="px-3 text-right">{money(item.cost, item.currency)}</td><td className={`px-3 text-right font-semibold ${item.profit < 0 ? "text-[#9a4d55]" : "text-[#397052]"}`}>{money(item.profit, item.currency)}</td><td className="px-3 text-right">{percentage(item.margin_percent)}</td><td className="px-3 text-right">{money(item.receivables, item.currency)}</td><td className={`px-3 text-right ${item.overdue_receivables ? "font-semibold text-[#9a4d55]" : ""}`}>{money(item.overdue_receivables, item.currency)}</td><td className="px-3 text-right">{money(item.payables, item.currency)}</td><td className={`px-4 text-right ${item.overdue_payables ? "font-semibold text-[#8a6734]" : ""}`}>{money(item.overdue_payables, item.currency)}</td></tr>)}</tbody></table></div> : <OpsEmptyState compact title="No financial activity" detail="There is no P&L or live balance information for this reporting range."/>}
      </OpsPanel>

      <OpsTableFrame toolbar={<TableHeading title="Branch performance" detail="Selected-period P&L by recognised KCPL branch."/>}>
        <table className="ops-dense-table min-w-[850px]"><thead><tr><th className="px-4 text-left">Branch</th><th className="px-3 text-left">Currency</th><th className="px-3 text-right">Revenue</th><th className="px-3 text-right">Cost</th><th className="px-3 text-right">Profit</th><th className="px-3 text-right">Margin</th><th className="px-4 text-right">Active jobs</th></tr></thead><tbody>{analytics.branches.length ? analytics.branches.map((row) => <tr key={`${row.branch}-${row.currency}`}><td className="px-4"><span className="inline-flex items-center gap-2 font-medium"><Landmark size={12} className="text-[#7b86b8]"/>{row.branch}</span></td><td className="px-3">{row.currency}</td><td className="px-3 text-right">{money(row.revenue, row.currency)}</td><td className="px-3 text-right">{money(row.cost, row.currency)}</td><td className={`px-3 text-right font-medium ${row.profit < 0 ? "text-[#9a4d55]" : "text-[#397052]"}`}>{money(row.profit, row.currency)}</td><td className="px-3 text-right">{percentage(row.margin_percent)}</td><td className="px-4 text-right font-medium">{row.active_jobs}</td></tr>) : <tr><td colSpan={7}><OpsEmptyState compact title="No branch P&L"/></td></tr>}</tbody></table>
      </OpsTableFrame>

      <div className="ops-grid-even">
        <OpsTableFrame toolbar={<TableHeading title="Customer profitability" detail="Top customers ranked by selected-period profit within currency."/>}>
          <table className="ops-dense-table min-w-[720px]"><thead><tr><th className="px-4 text-left">Customer</th><th className="px-3 text-left">Currency</th><th className="px-3 text-right">Revenue</th><th className="px-3 text-right">Profit</th><th className="px-4 text-right">Margin</th></tr></thead><tbody>{topCustomers.length ? topCustomers.map((row) => <tr key={`${row.customer_id || row.customer_name}-${row.currency}`}><td className="px-4"><strong className="font-medium">{row.customer_name}</strong>{row.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(row.customer_id)}`} className="ml-2 text-[9px] font-semibold text-[#5367a8]">Open 360</Link> : null}<p className="mt-0.5 text-[9px] text-[#989fa6]">{row.shipment_count} jobs · {row.invoice_count} invoices</p></td><td className="px-3">{row.currency}</td><td className="px-3 text-right">{money(row.revenue, row.currency)}</td><td className={`px-3 text-right font-medium ${row.profit < 0 ? "text-[#9a4d55]" : "text-[#397052]"}`}>{money(row.profit, row.currency)}</td><td className="px-4 text-right">{percentage(row.margin_percent)}</td></tr>) : <tr><td colSpan={5}><OpsEmptyState compact title="No customer P&L"/></td></tr>}</tbody></table>
        </OpsTableFrame>

        <OpsPanel title="Revenue concentration" eyebrow="Customer dependency" description="Calculated independently inside each currency.">
          {analytics.concentration.length ? <div className="divide-y divide-[#eceef0]">{analytics.concentration.map((risk) => <div key={risk.currency} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><div><strong className="text-xs font-semibold">{risk.currency}</strong><p className="mt-1 text-[10px] text-[#858c94]">{risk.top_customer_name || "No customer"}</p></div><OpsStatusBadge tone={risk.top_customer_share_percent >= 40 ? "danger" : risk.top_customer_share_percent >= 25 ? "warning" : "success"}>{risk.top_customer_share_percent.toFixed(1)}% top customer</OpsStatusBadge></div><div className="mt-2 h-1.5 overflow-hidden rounded bg-[#eceef0]"><div className="h-full rounded bg-[#6878c5]" style={{ width: `${Math.min(100, risk.top_customer_share_percent)}%` }}/></div><p className="mt-1.5 text-[9px] text-[#989fa6]">Top five {risk.top_five_share_percent.toFixed(1)}% of {money(risk.total_revenue, risk.currency)}</p></div>)}</div> : <OpsEmptyState compact title="Not enough customer revenue"/>}
        </OpsPanel>
      </div>

      <OpsTableFrame toolbar={<TableHeading title="Loss-making jobs" detail="Lifetime economics for jobs financially touched in this period." tone={lossJobs.length ? "danger" : "success"}/> }>
        <table className="ops-dense-table min-w-[980px]"><thead><tr><th className="px-4 text-left">Shipment</th><th className="px-3 text-left">Customer</th><th className="px-3 text-left">Route</th><th className="px-3 text-left">Branch</th><th className="px-3 text-right">Revenue</th><th className="px-3 text-right">Cost</th><th className="px-4 text-right">Loss</th></tr></thead><tbody>{lossJobs.length ? lossJobs.map((row) => <tr key={`${row.shipment_reference}-${row.currency}`}><td className="px-4"><Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="ops-row-link">{row.shipment_reference}</Link><p className="mt-0.5 text-[9px] text-[#989fa6]">{row.currency}</p></td><td className="px-3">{row.customer_name}</td><td className="px-3">{row.origin} → {row.destination}<p className="mt-0.5 text-[9px] text-[#989fa6]">{row.mode}</p></td><td className="px-3">{row.branch}</td><td className="px-3 text-right">{money(row.revenue, row.currency)}</td><td className="px-3 text-right">{money(row.cost, row.currency)}</td><td className="px-4 text-right font-semibold text-[#9a4d55]">{money(row.profit, row.currency)}</td></tr>) : <tr><td colSpan={7}><OpsEmptyState compact title="No loss-making jobs in this view" detail="Nothing currently requires margin intervention for the selected range."/></td></tr>}</tbody></table>
      </OpsTableFrame>

      <div className="ops-grid-even">
        <OpsTableFrame toolbar={<TableHeading title="Route performance" detail="Selected-period lane economics."/>}>
          <table className="ops-dense-table min-w-[720px]"><thead><tr><th className="px-4 text-left">Route</th><th className="px-3 text-left">Mode</th><th className="px-3 text-left">Currency</th><th className="px-3 text-right">Jobs</th><th className="px-3 text-right">Profit</th><th className="px-4 text-right">Margin</th></tr></thead><tbody>{topRoutes.length ? topRoutes.map((row) => <tr key={`${row.origin}-${row.destination}-${row.mode}-${row.currency}`}><td className="px-4 font-medium">{row.origin} → {row.destination}</td><td className="px-3">{row.mode}</td><td className="px-3">{row.currency}</td><td className="px-3 text-right">{row.jobs}</td><td className={`px-3 text-right font-medium ${row.profit < 0 ? "text-[#9a4d55]" : "text-[#397052]"}`}>{money(row.profit, row.currency)}</td><td className="px-4 text-right">{percentage(row.margin_percent)}</td></tr>) : <tr><td colSpan={6}><OpsEmptyState compact title="No route economics"/></td></tr>}</tbody></table>
        </OpsTableFrame>

        <OpsTableFrame toolbar={<TableHeading title="Staff workload" detail="Live assigned jobs and task pressure."/>}>
          <table className="ops-dense-table min-w-[650px]"><thead><tr><th className="px-4 text-left">Staff</th><th className="px-3 text-right">Active jobs</th><th className="px-3 text-right">Urgent</th><th className="px-3 text-right">Open tasks</th><th className="px-4 text-right">Overdue</th></tr></thead><tbody>{workload.length ? workload.map((row) => <tr key={`${row.staff_email || row.staff_name}`}><td className="px-4"><strong className="font-medium">{row.staff_name}</strong>{row.staff_email ? <p className="mt-0.5 text-[9px] text-[#989fa6]">{row.staff_email}</p> : null}</td><td className="px-3 text-right">{row.active_jobs}</td><td className={`px-3 text-right ${row.urgent_jobs ? "font-semibold text-[#9a4d55]" : ""}`}>{row.urgent_jobs}</td><td className="px-3 text-right">{row.open_tasks}</td><td className={`px-4 text-right ${row.overdue_tasks ? "font-semibold text-[#9a4d55]" : ""}`}>{row.overdue_tasks}</td></tr>) : <tr><td colSpan={5}><OpsEmptyState compact title="No workload data"/></td></tr>}</tbody></table>
        </OpsTableFrame>
      </div>

      <OpsTableFrame toolbar={<TableHeading title="Rolling monthly trend" detail="Revenue, recognised cost and gross profit by currency. Kept tabular for fast comparison rather than decorative charting."/>}>
        <table className="ops-dense-table min-w-[720px]"><thead><tr><th className="px-4 text-left">Month</th><th className="px-3 text-left">Currency</th><th className="px-3 text-right">Revenue</th><th className="px-3 text-right">Cost</th><th className="px-4 text-right">Profit</th></tr></thead><tbody>{analytics.trends.length ? analytics.trends.map((row) => <tr key={`${row.month}-${row.currency}`}><td className="px-4 font-medium">{row.month}</td><td className="px-3">{row.currency}</td><td className="px-3 text-right">{money(row.revenue, row.currency)}</td><td className="px-3 text-right">{money(row.cost, row.currency)}</td><td className={`px-4 text-right font-medium ${row.profit < 0 ? "text-[#9a4d55]" : "text-[#397052]"}`}>{money(row.profit, row.currency)}</td></tr>) : <tr><td colSpan={5}><OpsEmptyState compact title="No trend data"/></td></tr>}</tbody></table>
      </OpsTableFrame>
    </div>
  </main>;
}

function Pressure({ label, value, detail, tone = "neutral" }: { label: string; value: string | number; detail: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  return <div className="rounded-lg border border-[#e2e5e8] bg-white p-3.5"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-medium text-[#6f7780]">{label}</p><OpsStatusBadge tone={tone}>{String(value)}</OpsStatusBadge></div><p className="mt-2 text-[10px] leading-4 text-[#969da4]">{detail}</p></div>;
}

function TableHeading({ title, detail, tone }: { title: string; detail: string; tone?: "danger" | "success" }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xs font-semibold text-[#30363d]">{title}</h2><p className="mt-0.5 text-[10px] text-[#8c939b]">{detail}</p></div>{tone ? <OpsStatusBadge tone={tone}>{tone === "danger" ? "Needs attention" : "Clear"}</OpsStatusBadge> : null}</div>;
}
