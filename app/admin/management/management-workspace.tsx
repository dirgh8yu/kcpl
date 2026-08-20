import Link from "next/link";
import { AlertTriangle, BadgeDollarSign, Boxes, BriefcaseBusiness, Building2, Download, Landmark, PackageCheck, Route, Scale, Target, TrendingDown, TrendingUp, UsersRound, WalletCards } from "lucide-react";
import type { CrmCurrency } from "../crm/crm-data";
import type { ManagementAnalytics, ManagementRangeKey, TrendPoint } from "./management-data";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function number(value: number) {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(value);
}

function percentage(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)}%`;
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
  const trendCurrencies = [...new Set(analytics.trends.map((item) => item.currency))];
  const quality = analytics.data_quality;
  const dataQualityCount = quality.excluded_currency_records + quality.unassigned_branch_financial_records + quality.active_unassigned_branch_shipments + quality.unlinked_invoice_records + quality.orphaned_job_cost_records;
  const executivePressure = analytics.urgent_shipments + analytics.exception_shipments + analytics.customs_blocked_shipments + analytics.unassigned_shipments + analytics.loss_making_jobs.length;

  return <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
    <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a763b]">Management Intelligence</p><ScopeBadge label={analytics.range.label}/></div>
            <h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Executive Dashboard</h1>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#68747f]">Selected-period performance, live working-capital pressure and current operational exceptions. Financial currencies are never combined.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href={`/api/admin/management/export?${exportQuery}`} className="flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-4 py-2.5 text-xs font-black"><Download size={14}/>Export CSV</Link><Link href="/admin/command-centre" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-black text-white">Operations Home</Link></div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">{ranges.map((item) => <Link key={item.key} href={`/admin/management?range=${item.key}`} className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${analytics.range.key === item.key ? "border-[#10263f] bg-[#10263f] text-white" : "border-[#dfe3e8] bg-[#f8f9fa] text-[#596674] hover:bg-white"}`}>{item.label}</Link>)}</div>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="range" value="custom"/><label><span className="mb-1 block text-[8px] font-black uppercase tracking-[.12em] text-[#8a949e]">From</span><input name="from" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.from ?? "" : ""} className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-xs"/></label><label><span className="mb-1 block text-[8px] font-black uppercase tracking-[.12em] text-[#8a949e]">To</span><input name="to" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.to ?? "" : ""} className="rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-xs"/></label><button className="rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] px-4 py-2.5 text-[10px] font-black">Apply range</button></form>
      </div>
    </header>

    <section className="bg-[#0a1828] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <HeroMetric label="Active shipments" value={number(analytics.active_shipments)} icon={<Boxes size={15}/>} scope="Live"/>
        <HeroMetric label="Delivered" value={number(analytics.delivered_in_period)} icon={<PackageCheck size={15}/>} scope="Period"/>
        <HeroMetric label="Quote win rate" value={`${analytics.quote_conversion_percent.toFixed(1)}%`} icon={<Target size={15}/>} scope="Decided cohort"/>
        <HeroMetric label="Urgent / exception" value={`${analytics.urgent_shipments} / ${analytics.exception_shipments}`} icon={<AlertTriangle size={15}/>} scope="Live" danger={analytics.urgent_shipments + analytics.exception_shipments > 0}/>
        <HeroMetric label="Customs blocked" value={number(analytics.customs_blocked_shipments)} icon={<Scale size={15}/>} scope="Live" danger={analytics.customs_blocked_shipments > 0}/>
        <HeroMetric label="Unassigned jobs" value={number(analytics.unassigned_shipments)} icon={<UsersRound size={15}/>} scope="Live" danger={analytics.unassigned_shipments > 0}/>
      </div>
    </section>

    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="grid gap-3 md:grid-cols-4">
        <AttentionCard label="Management pressure" value={number(executivePressure)} detail="Urgent, exception, customs, unassigned and loss-making signals" danger={executivePressure > 0}/>
        <AttentionCard label="Quote decisions" value={`${analytics.quote_decided}/${analytics.quote_total}`} detail={`${analytics.quote_open} still open · ${analytics.quote_decision_rate_percent.toFixed(1)}% decision rate`}/>
        <AttentionCard label="Loss-making jobs" value={number(analytics.loss_making_jobs.length)} detail="Lifetime economics, limited to jobs financially touched in period" danger={analytics.loss_making_jobs.length > 0}/>
        <AttentionCard label="Data quality" value={number(dataQualityCount)} detail={dataQualityCount ? "Records need management-data cleanup" : "No tracked reporting integrity issues"} danger={dataQualityCount > 0}/>
      </section>

      {dataQualityCount ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700"/><div><p className="text-xs font-black text-amber-900">Reporting integrity flags</p><p className="mt-1 text-[11px] leading-5 text-amber-800">Analytics excluded {quality.excluded_currency_records} unsupported-currency financial records{quality.excluded_currency_values.length ? ` (${quality.excluded_currency_values.join(", ")})` : ""}; found {quality.unassigned_branch_financial_records} period financial records without a recognised branch, {quality.active_unassigned_branch_shipments} active shipments without a recognised branch, {quality.unlinked_invoice_records} period invoices without a shipment link, and {quality.orphaned_job_cost_records} period cost records whose shipment was not present in the loaded shipment set.</p></div></div></section> : null}

      <section>
        <SectionHeading eyebrow="Money by currency" title="Period P&L + live working capital" detail="Revenue and recognised job cost follow the selected range. AR and AP are current open balances as of now." badges={["Period P&L", "Live AR/AP"]}/>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">{analytics.financials.length ? analytics.financials.map((item) => <div key={item.currency} className="rounded-2xl border border-[#dfe3e8] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#9a763b]">{item.currency}</p><h3 className="mt-1 text-2xl font-black tracking-[-.03em]">{money(item.profit, item.currency)} gross profit</h3><p className="mt-1 text-[10px] text-[#7b8792]">{item.invoice_count} invoices · {item.cost_item_count} recognised cost items</p></div><span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${item.profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{percentage(item.margin_percent)} margin</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><MoneyMini label="Revenue" value={money(item.revenue, item.currency)} icon={<TrendingUp size={12}/>}/><MoneyMini label="Cost" value={money(item.cost, item.currency)} icon={<TrendingDown size={12}/>}/><MoneyMini label="AR open" value={money(item.receivables, item.currency)} icon={<BadgeDollarSign size={12}/>} warn={item.overdue_receivables > 0}/><MoneyMini label="AP open" value={money(item.payables, item.currency)} icon={<WalletCards size={12}/>} warn={item.overdue_payables > 0}/></div>{item.overdue_receivables || item.overdue_payables ? <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black"><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">Overdue AR {money(item.overdue_receivables, item.currency)}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">Overdue AP {money(item.overdue_payables, item.currency)}</span></div> : null}</div>) : <Empty text="No financial activity or live balances for this range."/>}</div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel><SectionHeading eyebrow="Branch performance" title="Where value is being created" detail="Selected-period P&L only. A branch is shown only when it has financial activity in that currency." badges={["Period"]}/><div className="mt-4 overflow-x-auto"><table className="min-w-[820px] w-full text-left text-xs"><thead className="border-b border-[#e6e9ec] text-[8px] font-black uppercase tracking-[.11em] text-[#8b96a0]"><tr><th className="py-3">Branch</th><th>Currency</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th><th className="text-right">Active jobs</th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{analytics.branches.length ? analytics.branches.map((row) => <tr key={`${row.branch}-${row.currency}`}><td className="py-3 font-black"><span className="inline-flex items-center gap-2"><Landmark size={12} className="text-[#9a763b]"/>{row.branch}</span></td><td>{row.currency}</td><td className="text-right">{money(row.revenue, row.currency)}</td><td className="text-right">{money(row.cost, row.currency)}</td><td className={`text-right font-black ${row.profit < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(row.profit, row.currency)}</td><td className="text-right">{percentage(row.margin_percent)}</td><td className="text-right font-black">{row.active_jobs}</td></tr>) : <tr><td colSpan={7} className="py-8 text-center text-[#8b96a0]">No branch P&L in this period.</td></tr>}</tbody></table></div></Panel>

        <section className="rounded-2xl bg-[#10263f] p-5 text-white"><SectionHeading eyebrow="Concentration" title="Customer dependency" detail="Revenue concentration is calculated independently inside each currency." inverse badges={["Period"]}/><div className="mt-4 space-y-3">{analytics.concentration.length ? analytics.concentration.map((risk) => <div key={risk.currency} className="rounded-xl border border-white/10 bg-white/[.04] p-4"><div className="flex items-center justify-between gap-3"><strong>{risk.currency}</strong><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${risk.top_customer_share_percent >= 40 ? "bg-rose-400/15 text-rose-200" : risk.top_customer_share_percent >= 25 ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>{risk.top_customer_share_percent.toFixed(1)}% top customer</span></div><p className="mt-2 text-xs font-bold text-white/75">{risk.top_customer_name}</p><p className="mt-1 text-[9px] text-white/40">Top five: {risk.top_five_share_percent.toFixed(1)}% of {money(risk.total_revenue, risk.currency)}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#d4ad62]" style={{ width: `${Math.min(100, risk.top_customer_share_percent)}%` }}/></div></div>) : <p className="text-xs text-white/40">Not enough customer revenue yet.</p>}</div></section>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel><SectionHeading eyebrow="Customers" title="Customer profitability" detail="Selected-period customer P&L, ranked by profit within currency." badges={["Period"]}/><div className="mt-4 overflow-x-auto"><table className="min-w-[740px] w-full text-left text-xs"><thead className="border-b border-[#e6e9ec] text-[8px] font-black uppercase tracking-[.1em] text-[#8b96a0]"><tr><th className="py-3">Customer</th><th>Currency</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{topCustomers.length ? topCustomers.map((row) => <tr key={`${row.customer_id || row.customer_name}-${row.currency}`}><td className="py-3"><strong>{row.customer_name}</strong>{row.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(row.customer_id)}`} className="ml-2 text-[9px] font-black text-[#9a763b]">360°</Link> : null}<p className="mt-1 text-[9px] text-[#8b96a0]">{row.shipment_count} jobs · {row.invoice_count} invoices</p></td><td>{row.currency}</td><td className="text-right">{money(row.revenue, row.currency)}</td><td className="text-right">{money(row.cost, row.currency)}</td><td className={`text-right font-black ${row.profit < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(row.profit, row.currency)}</td><td className="text-right">{percentage(row.margin_percent)}</td></tr>) : <tr><td colSpan={6} className="py-8 text-center text-[#8b96a0]">No customer P&L yet.</td></tr>}</tbody></table></div></Panel>

        <Panel><SectionHeading eyebrow="Routes" title="Lane & mode profitability" detail="Selected-period economics by origin, destination, mode and currency." badges={["Period"]}/><div className="mt-4 space-y-2">{topRoutes.length ? topRoutes.map((row) => <div key={`${row.origin}-${row.destination}-${row.mode}-${row.currency}`} className="rounded-xl border border-[#e3e7ea] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Route size={13} className="text-[#9a763b]"/><strong className="text-sm">{row.origin} → {row.destination}</strong></div><p className="mt-1 text-[9px] text-[#7b8792]">{row.mode} · {row.jobs} jobs · {row.currency}</p></div><div className="text-right"><strong className={row.profit < 0 ? "text-rose-700" : "text-emerald-700"}>{money(row.profit, row.currency)}</strong><p className="mt-1 text-[9px] text-[#7b8792]">{percentage(row.margin_percent)} margin</p></div></div></div>) : <Empty text="No route profitability in this period."/>}</div></Panel>
      </section>

      <Panel><SectionHeading eyebrow="Trend" title="Rolling 12-month revenue vs recognised cost" detail="Always shows the latest 12 operational months, independent of the selected dashboard range, and never combines currencies." badges={["Rolling 12M"]}/><div className="mt-5 grid gap-4 xl:grid-cols-2">{trendCurrencies.length ? trendCurrencies.map((currency) => <TrendChart key={currency} currency={currency} points={analytics.trends.filter((item) => item.currency === currency)}/>) : <Empty text="No 12-month trend data yet."/>}</div></Panel>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel><SectionHeading eyebrow="Exception P&L" title="Loss-making jobs" detail="Lifetime invoiced revenue versus lifetime recognised job cost, limited to jobs with financial activity in the selected period." badges={["Lifetime economics", "Period cohort"]}/>{lossJobs.length ? <div className="mt-4 space-y-2">{lossJobs.map((job) => <Link key={`${job.shipment_reference}-${job.currency}`} href={`/admin/jobs/${encodeURIComponent(job.shipment_reference)}/profitability`} className="block rounded-xl border border-rose-100 bg-rose-50/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm">{job.shipment_reference}</strong><p className="mt-1 text-[9px] text-[#6f7b86]">{job.customer_name} · {job.origin} → {job.destination} · {job.branch}</p><p className="mt-1 text-[9px] text-[#9a6b6b]">Period movement: {money(job.period_profit, job.currency)}</p></div><div className="text-right"><strong className="text-rose-700">{money(job.profit, job.currency)}</strong><p className="mt-1 text-[9px] text-[#7b8792]">Lifetime · {percentage(job.margin_percent)} margin</p></div></div></Link>)}</div> : <div className="mt-4 rounded-xl bg-emerald-50 p-5 text-sm font-bold text-emerald-800">No lifetime loss-making jobs were financially touched in this range.</div>}</Panel>

        <Panel><SectionHeading eyebrow="People" title="Staff workload" detail="Current open jobs, urgent jobs and task pressure from Digital Job Files." badges={["Live"]}/><div className="mt-4 space-y-2">{workload.length ? workload.map((row) => <div key={row.staff_email || row.staff_name} className="rounded-xl border border-[#e3e7ea] p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#10263f] text-xs font-black text-white">{row.staff_name.slice(0, 1).toUpperCase()}</span><div><strong className="text-sm">{row.staff_name}</strong><p className="mt-1 text-[9px] text-[#8b96a0]">{row.staff_email || "No email assigned"}</p></div></div><div className="text-right text-[9px] font-black"><p>{row.active_jobs} jobs · {row.open_tasks} tasks</p><p className={row.overdue_tasks || row.urgent_jobs ? "mt-1 text-rose-700" : "mt-1 text-[#8b96a0]"}>{row.urgent_jobs} urgent · {row.overdue_tasks} overdue</p></div></div></div>) : <Empty text="No staff workload data yet."/>}</div></Panel>
      </section>

      <section className="grid gap-3 md:grid-cols-3"><SummaryCard title="Quote cohort" icon={<Target size={16}/>} main={`${analytics.quote_won} won / ${analytics.quote_decided} decided`} detail={`${analytics.quote_open} open of ${analytics.quote_total} created · ${analytics.quote_conversion_percent.toFixed(1)}% win rate`}/><SummaryCard title="Operational throughput" icon={<BriefcaseBusiness size={16}/>} main={`${analytics.active_shipments} active jobs`} detail={`${analytics.delivered_in_period} delivered in selected period`}/><SummaryCard title="Management scope" icon={<Building2 size={16}/>} main={`${analytics.customers.length} customer/currency P&Ls`} detail={`${analytics.jobs.length} lifetime job P&Ls touched in period`}/></section>
    </div>
  </main>;
}

function ScopeBadge({ label }: { label: string }) { return <span className="rounded-full bg-[#f2eadc] px-2 py-1 text-[8px] font-black uppercase tracking-[.08em] text-[#805e28]">{label}</span>; }
function HeroMetric({ label, value, icon, scope, danger = false }: { label: string; value: string; icon: React.ReactNode; scope: string; danger?: boolean }) { return <div className={`rounded-xl border p-3.5 ${danger ? "border-rose-300/25 bg-rose-400/10" : "border-white/10 bg-white/[.035]"}`}><div className={`flex items-center gap-2 ${danger ? "text-rose-200" : "text-white/40"}`}>{icon}<span className="text-[8px] font-black uppercase tracking-[.1em]">{label}</span></div><p className={`mt-2 text-2xl font-black ${danger ? "text-rose-100" : "text-white"}`}>{value}</p><p className="mt-1 text-[8px] font-bold uppercase tracking-[.08em] text-white/25">{scope}</p></div>; }
function AttentionCard({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) { return <div className={`rounded-xl border bg-white p-4 ${danger ? "border-rose-200" : "border-[#dfe3e8]"}`}><p className={`text-[8px] font-black uppercase tracking-[.11em] ${danger ? "text-rose-700" : "text-[#8b96a0]"}`}>{label}</p><p className={`mt-2 text-2xl font-black ${danger ? "text-rose-800" : ""}`}>{value}</p><p className="mt-1 text-[9px] leading-4 text-[#7b8792]">{detail}</p></div>; }
function MoneyMini({ label, value, icon, warn = false }: { label: string; value: string; icon: React.ReactNode; warn?: boolean }) { return <div className={`rounded-lg border p-3 ${warn ? "border-rose-200 bg-rose-50" : "border-[#e4e7ea] bg-[#fafbfb]"}`}><div className="flex items-center gap-1.5 text-[#8b96a0]">{icon}<span className="text-[8px] font-black uppercase tracking-[.08em]">{label}</span></div><p className={`mt-1 text-xs font-black ${warn ? "text-rose-700" : ""}`}>{value}</p></div>; }
function SectionHeading({ eyebrow, title, detail, inverse = false, badges = [] }: { eyebrow: string; title: string; detail: string; inverse?: boolean; badges?: string[] }) { return <div><div className="flex flex-wrap items-center gap-2"><p className={`text-[9px] font-black uppercase tracking-[.14em] ${inverse ? "text-[#d4ad62]" : "text-[#9a763b]"}`}>{eyebrow}</p>{badges.map((badge) => <span key={badge} className={`rounded-full px-2 py-1 text-[7px] font-black uppercase tracking-[.08em] ${inverse ? "bg-white/8 text-white/45" : "bg-[#f1f3f4] text-[#7b8792]"}`}>{badge}</span>)}</div><h2 className={`mt-1 text-xl font-black tracking-[-.03em] ${inverse ? "text-white" : ""}`}>{title}</h2><p className={`mt-1.5 text-[11px] leading-5 ${inverse ? "text-white/45" : "text-[#68747f]"}`}>{detail}</p></div>; }
function Panel({ children }: { children: React.ReactNode }) { return <section className="rounded-2xl border border-[#dfe3e8] bg-white p-5 sm:p-6">{children}</section>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl bg-[#f7f8f9] p-5 text-xs text-[#7b8792]">{text}</div>; }
function SummaryCard({ title, main, detail, icon }: { title: string; main: string; detail: string; icon: React.ReactNode }) { return <div className="rounded-xl border border-[#dfe3e8] bg-white p-4"><div className="flex items-center gap-2 text-[#9a763b]">{icon}<span className="text-[8px] font-black uppercase tracking-[.1em]">{title}</span></div><p className="mt-2 text-xl font-black">{main}</p><p className="mt-1 text-[10px] text-[#7b8792]">{detail}</p></div>; }

function TrendChart({ currency, points }: { currency: CrmCurrency; points: TrendPoint[] }) {
  const maximum = Math.max(1, ...points.flatMap((point) => [point.revenue, point.cost]));
  return <div className="rounded-xl bg-[#10263f] p-4 text-white"><div className="flex items-center justify-between"><div><p className="text-[8px] font-black uppercase tracking-[.1em] text-[#d4ad62]">{currency}</p><h3 className="mt-1 text-sm font-black">12-month movement</h3></div><div className="flex gap-3 text-[8px] font-black uppercase text-white/35"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#d4ad62]"/>Revenue</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-white/35"/>Cost</span></div></div><div className="mt-4 flex min-h-40 items-end gap-2 overflow-x-auto pb-1">{points.map((point) => <div key={`${point.month}-${point.currency}`} className="flex min-w-10 flex-1 flex-col items-center"><div className="flex h-28 w-full items-end justify-center gap-1"><div title={`Revenue ${money(point.revenue, currency)}`} className="w-2.5 rounded-t bg-[#d4ad62]" style={{ height: `${Math.max(point.revenue ? 4 : 0, (point.revenue / maximum) * 100)}%` }}/><div title={`Cost ${money(point.cost, currency)}`} className="w-2.5 rounded-t bg-white/35" style={{ height: `${Math.max(point.cost ? 4 : 0, (point.cost / maximum) * 100)}%` }}/></div><span className="mt-2 text-[7px] font-black text-white/30">{point.month.slice(5)}</span></div>)}</div></div>;
}
