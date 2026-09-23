import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Download } from "lucide-react";
import type { CrmCurrency } from "../crm/crm-data";
import type { ManagementAnalytics, ManagementRangeKey, TrendPoint } from "./management-data";
import { OpsBadge, OpsFact, OpsFacts, OpsInlineAlert, OpsKpiRail, OpsPage, OpsPageHeader, OpsProgress, OpsRailMetric, OpsSurface, OpsTableWrap } from "../operations-ui";

function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString("en-AU")}`; } }
function percentage(value: number | null) { return value === null ? "N/A" : `${value.toFixed(1)}%`; }
function queryFor(range: ManagementAnalytics["range"]) { const params = new URLSearchParams({ range: range.key }); if (range.from) params.set("from", range.from); if (range.to) params.set("to", range.to); return params.toString(); }

const ranges: Array<{ key: ManagementRangeKey; label: string }> = [
  { key: "today", label: "Today" }, { key: "7d", label: "7 days" }, { key: "month", label: "Month" }, { key: "quarter", label: "Quarter" }, { key: "year", label: "Year" }, { key: "all", label: "All time" },
];

export function ManagementWorkspace({ analytics, readiness }: { analytics: ManagementAnalytics; readiness?: ReactNode }) {
  const exportQuery = queryFor(analytics.range);
  const topCustomers = analytics.customers.slice(0, 12);
  const topRoutes = analytics.routes.slice(0, 10);
  const lossJobs = analytics.loss_making_jobs.slice(0, 10);
  const workload = analytics.staff_workload.slice(0, 12);
  const trendCurrencies = [...new Set(analytics.trends.map((item) => item.currency))];
  const quality = analytics.data_quality;
  const dataQualityCount = quality.excluded_currency_records + quality.unassigned_branch_financial_records + quality.active_unassigned_branch_shipments + quality.unlinked_invoice_records + quality.orphaned_job_cost_records;
  const generated = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(analytics.generated_at));

  return <OpsPage>
    <OpsPageHeader
      title="Analytics"
      description="Period performance, live working capital and operational pressure. Currencies are never blended."
      meta={<span>{analytics.range.label} · generated {generated}</span>}
      actions={<>
        <Link href={`/api/admin/management/export?${exportQuery}`} className="ops-button" data-variant="secondary" data-size="md"><Download size={16} strokeWidth={1.75} aria-hidden="true"/>Export CSV</Link>
        <Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations home</Link>
      </>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6">
      <div className="mgmt-range">
        <nav className="ops-scope-tabs" aria-label="Reporting period">
          {ranges.map((item) => {
            const active = analytics.range.key === item.key;
            return <Link key={item.key} href={`/admin/management?range=${item.key}`} className="ops-scope-tab" data-active={active || undefined} aria-current={active ? "page" : undefined}>{item.label}</Link>;
          })}
        </nav>
        <form method="get" className="mgmt-range-form" aria-label="Custom reporting period">
          <input type="hidden" name="range" value="custom"/>
          <label><span>From</span><input name="from" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.from ?? "" : ""} className="ops-input"/></label>
          <label><span>To</span><input name="to" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.to ?? "" : ""} className="ops-input"/></label>
          <button className="ops-button" data-variant="secondary" data-size="sm">Apply</button>
        </form>
      </div>

      <OpsKpiRail label="Live operations">
        <OpsRailMetric label="Active shipments" value={analytics.active_shipments}/>
        <OpsRailMetric label="Delivered in period" value={analytics.delivered_in_period}/>
        <OpsRailMetric label="Quote win rate" value={`${analytics.quote_conversion_percent.toFixed(1)}%`}/>
        <OpsRailMetric label="Urgent / exception" value={`${analytics.urgent_shipments} / ${analytics.exception_shipments}`} tone={analytics.urgent_shipments + analytics.exception_shipments ? "danger" : "neutral"}/>
        <OpsRailMetric label="Customs blocked" value={analytics.customs_blocked_shipments} tone={analytics.customs_blocked_shipments ? "warning" : "neutral"}/>
        <OpsRailMetric label="Unassigned" value={analytics.unassigned_shipments} tone={analytics.unassigned_shipments ? "warning" : "neutral"}/>
      </OpsKpiRail>
      <OpsKpiRail label="Period decisions">
        <OpsRailMetric label="Quote decisions" value={`${analytics.quote_decided}/${analytics.quote_total}`} detail={`${analytics.quote_open} open · ${analytics.quote_decision_rate_percent.toFixed(1)}% decided`}/>
        <OpsRailMetric label="Loss-making jobs" value={analytics.loss_making_jobs.length} tone={analytics.loss_making_jobs.length ? "danger" : "neutral"} detail="Financially touched in period"/>
        <OpsRailMetric label="Data quality" value={dataQualityCount} tone={dataQualityCount ? "warning" : "neutral"} detail={dataQualityCount ? "Records need cleanup" : "No tracked issues"}/>
      </OpsKpiRail>

      {dataQualityCount ? <div className="org-notice"><OpsInlineAlert icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>}><strong>Reporting integrity:</strong> {dataQualityCount} tracked records need cleanup · {quality.excluded_currency_records} unsupported currency · {quality.unassigned_branch_financial_records} unassigned financial · {quality.active_unassigned_branch_shipments} unassigned shipments · {quality.unlinked_invoice_records} unlinked invoices · {quality.orphaned_job_cost_records} orphaned costs.</OpsInlineAlert></div> : null}

      <SectionHead title="Period P&L and live working capital" detail="Revenue and recognised job cost follow the selected range. AR and AP are current open balances."/>
      <div className="mgmt-cards">{analytics.financials.length ? analytics.financials.map((item) => <OpsSurface key={item.currency} density="compact" title={`${item.currency} · ${money(item.profit, item.currency)} gross profit`} description={`${item.invoice_count} invoices · ${item.cost_item_count} recognised costs`} action={<OpsBadge tone={item.profit >= 0 ? "success" : "danger"}>{percentage(item.margin_percent)} margin</OpsBadge>}>
        <OpsFacts columns={2}>
          <OpsFact label="Revenue">{money(item.revenue, item.currency)}</OpsFact>
          <OpsFact label="Cost">{money(item.cost, item.currency)}</OpsFact>
          <OpsFact label="AR open" warning={item.overdue_receivables > 0}>{money(item.receivables, item.currency)}</OpsFact>
          <OpsFact label="AP open" warning={item.overdue_payables > 0}>{money(item.payables, item.currency)}</OpsFact>
          {item.overdue_receivables ? <OpsFact label="Overdue AR" warning>{money(item.overdue_receivables, item.currency)}</OpsFact> : null}
          {item.overdue_payables ? <OpsFact label="Overdue AP" warning>{money(item.overdue_payables, item.currency)}</OpsFact> : null}
        </OpsFacts>
      </OpsSurface>) : <Empty text="No financial activity or live balances for this range."/>}</div>

      {trendCurrencies.length ? <>
        <SectionHead title="Monthly revenue, cost and profit" detail="A compact trend view, separated by currency."/>
        <div className="mgmt-cards">{trendCurrencies.map((currency) => <TrendChart key={currency} currency={currency} points={analytics.trends.filter((item) => item.currency === currency)}/>)}</div>
      </> : null}

      <SectionHead title="Where value is created" detail="Selected-period economics by branch, customer and route."/>
      <div className="mgmt-grid">
        <OpsSurface density="compact" title="Branch performance" description="Selected-period P&L by branch and currency." flush>
          {analytics.branches.length ? <OpsTableWrap><table className="ops-table ops-register-table mgmt-table" aria-label="Branch performance"><thead><tr><th>Branch</th><th className="ops-col-num">Revenue</th><th className="ops-col-num">Profit</th><th className="ops-col-num">Margin</th><th className="ops-col-num">Active jobs</th></tr></thead><tbody>{analytics.branches.map((row) => <tr key={`${row.branch}-${row.currency}`}>
            <td>{row.branch === "Unassigned" ? <span className="ops-cell-primary">{row.branch}</span> : <Link href={`/admin/branches/${encodeURIComponent(row.branch)}`} className="ops-cell-primary org-link">{row.branch}</Link>}<span className="ops-cell-secondary">{row.currency} · cost {money(row.cost, row.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-num">{money(row.revenue, row.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-num" data-negative={row.profit < 0 || undefined}>{money(row.profit, row.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-cell-muted">{percentage(row.margin_percent)}</span></td>
            <td className="ops-col-num"><span className="ops-num">{row.active_jobs}</span></td>
          </tr>)}</tbody></table></OpsTableWrap> : <Empty text="No branch P&L in this period."/>}
        </OpsSurface>
        <OpsSurface density="compact" title="Customer dependency" description="Revenue concentration inside each currency.">
          {analytics.concentration.length ? <ul className="mgmt-concentration">{analytics.concentration.map((risk) => {
            const riskTone = risk.top_customer_share_percent >= 40 ? "danger" : risk.top_customer_share_percent >= 25 ? "warning" : "success";
            return <li key={risk.currency}>
              <div className="mgmt-concentration-head">
                <div className="min-w-0"><strong>{risk.currency} · {risk.top_customer_name || "No customer"}</strong><span>Top five {risk.top_five_share_percent.toFixed(1)}% of {money(risk.total_revenue, risk.currency)}</span></div>
                <OpsBadge tone={riskTone}>{risk.top_customer_share_percent.toFixed(1)}% top customer</OpsBadge>
              </div>
              <OpsProgress value={risk.top_customer_share_percent} max={100} tone={riskTone}/>
            </li>;
          })}</ul> : <Empty text="Not enough customer revenue yet."/>}
        </OpsSurface>
        <OpsSurface density="compact" title="Customer profitability" description="Selected-period P&L ranked by profit within currency." flush>
          {topCustomers.length ? <OpsTableWrap><table className="ops-table ops-register-table mgmt-table" aria-label="Customer profitability"><thead><tr><th>Customer</th><th className="ops-col-num">Revenue</th><th className="ops-col-num">Profit</th><th className="ops-col-num">Margin</th></tr></thead><tbody>{topCustomers.map((row) => <tr key={`${row.customer_id || row.customer_name}-${row.currency}`}>
            <td>{row.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(row.customer_id)}`} className="ops-cell-primary ops-cell-clamp org-link" title={row.customer_name}>{row.customer_name}</Link> : <span className="ops-cell-primary ops-cell-clamp" title={row.customer_name}>{row.customer_name}</span>}<span className="ops-cell-secondary">{row.currency} · cost {money(row.cost, row.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-num">{money(row.revenue, row.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-num" data-negative={row.profit < 0 || undefined}>{money(row.profit, row.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-cell-muted">{percentage(row.margin_percent)}</span></td>
          </tr>)}</tbody></table></OpsTableWrap> : <Empty text="No customer P&L in this period."/>}
        </OpsSurface>
        <OpsSurface density="compact" title="Route economics" description="Selected-period route performance." flush>
          {topRoutes.length ? <OpsTableWrap><table className="ops-table ops-register-table mgmt-table" aria-label="Route economics"><thead><tr><th>Route</th><th className="ops-col-num">Jobs</th><th className="ops-col-num">Profit</th><th className="ops-col-num">Margin</th></tr></thead><tbody>{topRoutes.map((row, index) => <tr key={`${row.origin}-${row.destination}-${row.mode}-${row.currency}-${index}`}>
            <td><span className="ops-cell-primary ops-cell-clamp" title={`${row.origin} → ${row.destination}`}>{row.origin} → {row.destination}</span><span className="ops-cell-secondary">{row.mode} · {row.currency}</span></td>
            <td className="ops-col-num"><span className="ops-num">{row.jobs}</span></td>
            <td className="ops-col-num"><span className="ops-num" data-negative={row.profit < 0 || undefined}>{money(row.profit, row.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-cell-muted">{percentage(row.margin_percent)}</span></td>
          </tr>)}</tbody></table></OpsTableWrap> : <Empty text="No route economics in this period."/>}
        </OpsSurface>
      </div>

      <SectionHead title="Exceptions and ownership" detail="Loss-making jobs in the period, and current staff workload independent of the financial range."/>
      <div className="mgmt-grid">
        <OpsSurface density="compact" title="Loss-making jobs" description="Negative lifetime economics with financial activity in the period." flush>
          {lossJobs.length ? <OpsTableWrap><table className="ops-table ops-register-table mgmt-table" aria-label="Loss-making jobs"><thead><tr><th>Shipment</th><th>Customer</th><th className="ops-col-num">Profit</th><th className="ops-col-num">Margin</th></tr></thead><tbody>{lossJobs.map((job) => <tr key={`${job.shipment_reference}-${job.currency}`}>
            <td><Link href={`/admin/jobs/${encodeURIComponent(job.shipment_reference)}`} className="ops-cell-primary ops-mono ops-cell-id org-link">{job.shipment_reference}</Link><span className="ops-cell-secondary">{job.branch} · {job.currency}</span></td>
            <td><span className="ops-cell-clamp" title={job.customer_name}>{job.customer_name}</span></td>
            <td className="ops-col-num"><span className="ops-num" data-negative>{money(job.profit, job.currency)}</span></td>
            <td className="ops-col-num"><span className="ops-num" data-negative>{percentage(job.margin_percent)}</span></td>
          </tr>)}</tbody></table></OpsTableWrap> : <Empty text="No loss-making jobs in the current slice."/>}
        </OpsSurface>
        <OpsSurface density="compact" title="Staff workload" description="Current ownership pressure." flush>
          {workload.length ? <OpsTableWrap><table className="ops-table ops-register-table mgmt-table" aria-label="Staff workload"><thead><tr><th>Staff</th><th className="ops-col-num">Jobs</th><th className="ops-col-num">Tasks</th><th className="ops-col-num">Overdue</th><th className="ops-col-num">Urgent</th></tr></thead><tbody>{workload.map((row, index) => <tr key={`${row.staff_email || row.staff_name}-${index}`}>
            <td>{row.staff_email ? <Link href={`/admin/workload/${encodeURIComponent(row.staff_email)}`} className="ops-cell-primary org-link">{row.staff_name}</Link> : <span className="ops-cell-primary">{row.staff_name}</span>}<span className="ops-cell-secondary ops-cell-clamp">{row.staff_email || "No email"}</span></td>
            <td className="ops-col-num"><span className="ops-num">{row.active_jobs}</span></td>
            <td className="ops-col-num"><span className="ops-num">{row.open_tasks}</span></td>
            <td className="ops-col-num"><span className="ops-num" data-negative={row.overdue_tasks > 0 || undefined}>{row.overdue_tasks}</span></td>
            <td className="ops-col-num"><span className="ops-num" data-warning={row.urgent_jobs > 0 || undefined}>{row.urgent_jobs}</span></td>
          </tr>)}</tbody></table></OpsTableWrap> : <Empty text="No staff workload yet."/>}
        </OpsSurface>
      </div>

      {readiness ? <div className="org-section">{readiness}</div> : null}
    </div>
  </OpsPage>;
}

function SectionHead({ title, detail }: { title: string; detail: string }) { return <div className="org-section-head"><h2>{title}</h2><p>{detail}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="org-empty">{text}</p>; }
function TrendChart({ currency, points }: { currency: CrmCurrency; points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.revenue, p.cost, Math.abs(p.profit))));
  return <OpsSurface density="compact" title={`${currency} · monthly movement`} description="Revenue and cost proportions within this currency, with monthly profit.">
    <ol className="mgmt-trend">{points.slice(-12).map((p) => <li key={`${p.month}-${p.currency}`}>
      <span className="mgmt-trend-month">{p.month}</span>
      <span className="mgmt-trend-bars" aria-hidden="true">
        <span className="mgmt-trend-bar" data-series="revenue"><span style={{ width: `${Math.max(1, p.revenue / max * 100)}%` }}/></span>
        <span className="mgmt-trend-bar" data-series="cost"><span style={{ width: `${Math.max(1, p.cost / max * 100)}%` }}/></span>
      </span>
      <span className="mgmt-trend-profit" data-negative={p.profit < 0 || undefined}>{money(p.profit, currency)}</span>
    </li>)}</ol>
    <p className="mgmt-trend-legend"><span data-series="revenue">Revenue</span><span data-series="cost">Cost</span><span>Profit at right</span></p>
  </OpsSurface>;
}
