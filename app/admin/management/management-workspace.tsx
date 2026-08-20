import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeDollarSign, Boxes, BriefcaseBusiness, Building2, Download, Landmark, PackageCheck, Route, Scale, Target, TrendingDown, TrendingUp, UsersRound, WalletCards } from "lucide-react";
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
  const branchRows = analytics.branches;
  const lossJobs = analytics.loss_making_jobs.slice(0, 12);
  const workload = analytics.staff_workload.slice(0, 15);
  const trendCurrencies = [...new Set(analytics.trends.map((item) => item.currency))];

  return <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
    <header className="bg-[#091624] px-5 py-6 text-white lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <Link href="/admin" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link>
            <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Management Intelligence</p><h1 className="mt-1 text-3xl font-black tracking-[-.05em]">Executive Dashboard</h1><p className="mt-2 text-xs text-white/45">Performance, profitability, working capital and operational pressure · {analytics.range.label}</p></div>
          </div>
          <div className="flex flex-wrap gap-2"><Link href={`/api/admin/management/export?${exportQuery}`} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-black text-white"><Download size={14}/>Export CSV</Link><Link href="/admin/command-centre" className="rounded-xl bg-[#d4ad62] px-4 py-3 text-xs font-black text-[#10263f]">Command Centre</Link></div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">{ranges.map((item) => <Link key={item.key} href={`/admin/management?range=${item.key}`} className={`rounded-full border px-3.5 py-2 text-[10px] font-black ${analytics.range.key === item.key ? "border-[#d4ad62] bg-[#d4ad62] text-[#10263f]" : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"}`}>{item.label}</Link>)}</div>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="range" value="custom"/><label><span className="mb-1 block text-[8px] font-black uppercase tracking-[.12em] text-white/35">From</span><input name="from" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.from ?? "" : ""} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white [color-scheme:dark]"/></label><label><span className="mb-1 block text-[8px] font-black uppercase tracking-[.12em] text-white/35">To</span><input name="to" type="date" defaultValue={analytics.range.key === "custom" ? analytics.range.to ?? "" : ""} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white [color-scheme:dark]"/></label><button className="rounded-xl border border-white/15 px-4 py-2.5 text-[10px] font-black text-white">Apply custom range</button></form>
      </div>
    </header>

    <section className="border-b border-black/10 bg-[#10263f] px-5 pb-6 text-white lg:px-8">
      <div className="mx-auto grid max-w-[1800px] grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <HeroMetric label="Active shipments" value={number(analytics.active_shipments)} icon={<Boxes size={15}/>}/>
        <HeroMetric label="Delivered in range" value={number(analytics.delivered_in_period)} icon={<PackageCheck size={15}/>}/>
        <HeroMetric label="Quote → Won" value={`${analytics.quote_conversion_percent.toFixed(1)}%`} icon={<Target size={15}/>}/>
        <HeroMetric label="Urgent / exception" value={`${analytics.urgent_shipments} / ${analytics.exception_shipments}`} icon={<AlertTriangle size={15}/>} danger={analytics.urgent_shipments + analytics.exception_shipments > 0}/>
        <HeroMetric label="Customs blocked" value={number(analytics.customs_blocked_shipments)} icon={<Scale size={15}/>} danger={analytics.customs_blocked_shipments > 0}/>
        <HeroMetric label="Unassigned jobs" value={number(analytics.unassigned_shipments)} icon={<UsersRound size={15}/>} danger={analytics.unassigned_shipments > 0}/>
      </div>
    </section>

    <div className="mx-auto max-w-[1800px] space-y-7 p-5 lg:p-8">
      <section>
        <SectionHeading eyebrow="Money by currency" title="Revenue, profit & working capital" detail="Revenue and cost use the selected period. Receivables and payables are current open balances."/>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">{analytics.financials.length ? analytics.financials.map((item) => <div key={item.currency} className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b78a3e]">{item.currency} performance</p><h3 className="mt-1 text-2xl font-black">{money(item.profit, item.currency)} gross profit</h3></div><span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${item.profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{percentage(item.margin_percent)} margin</span></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><MoneyMini label="Revenue" value={money(item.revenue, item.currency)} icon={<TrendingUp size={12}/>}/><MoneyMini label="Recognised cost" value={money(item.cost, item.currency)} icon={<TrendingDown size={12}/>}/><MoneyMini label="AR open" value={money(item.receivables, item.currency)} icon={<BadgeDollarSign size={12}/>} warn={item.overdue_receivables > 0}/><MoneyMini label="AP open" value={money(item.payables, item.currency)} icon={<WalletCards size={12}/>} warn={item.overdue_payables > 0}/></div>{item.overdue_receivables || item.overdue_payables ? <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black"><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">Overdue AR {money(item.overdue_receivables, item.currency)}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">Overdue AP {money(item.overdue_payables, item.currency)}</span></div> : null}</div>) : <Empty text="No financial activity yet for this range."/>}</div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><SectionHeading eyebrow="Branch comparison" title="Which branches are creating value?" detail="Branch P&L remains separated by currency."/><div className="mt-5 overflow-x-auto"><table className="min-w-[850px] w-full text-left text-xs"><thead className="border-b border-black/10 text-[8px] font-black uppercase tracking-[.11em] text-black/35"><tr><th className="py-3">Branch</th><th>Currency</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th><th className="text-right">Active jobs</th></tr></thead><tbody className="divide-y divide-black/8">{branchRows.map((row) => <tr key={`${row.branch}-${row.currency}`}><td className="py-3 font-black"><span className="inline-flex items-center gap-2"><Landmark size={12} className="text-[#b78a3e]"/>{row.branch}</span></td><td>{row.currency}</td><td className="text-right">{money(row.revenue, row.currency)}</td><td className="text-right">{money(row.cost, row.currency)}</td><td className={`text-right font-black ${row.profit < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(row.profit, row.currency)}</td><td className="text-right">{percentage(row.margin_percent)}</td><td className="text-right font-black">{row.active_jobs}</td></tr>)}</tbody></table></div></div>

        <div className="rounded-[28px] border border-black/10 bg-[#10263f] p-6 text-white shadow-sm sm:p-8"><SectionHeading eyebrow="Concentration" title="Customer dependency" detail="A high top-customer share means revenue is concentrated." inverse/><div className="mt-5 space-y-3">{analytics.concentration.length ? analytics.concentration.map((risk) => <div key={risk.currency} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="flex items-center justify-between gap-3"><strong>{risk.currency}</strong><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${risk.top_customer_share_percent >= 40 ? "bg-rose-400/15 text-rose-200" : risk.top_customer_share_percent >= 25 ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>{risk.top_customer_share_percent.toFixed(1)}% top customer</span></div><p className="mt-2 text-xs font-bold text-white/75">{risk.top_customer_name}</p><p className="mt-1 text-[9px] text-white/35">Top five account for {risk.top_five_share_percent.toFixed(1)}% of {money(risk.total_revenue, risk.currency)} revenue.</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#d4ad62]" style={{ width: `${Math.min(100, risk.top_customer_share_percent)}%` }}/></div></div>) : <p className="text-xs text-white/40">Not enough customer revenue yet.</p>}</div></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TablePanel eyebrow="Customers" title="Customer profitability" detail="Highest profit first within each currency."><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead className="border-b border-black/10 text-[8px] font-black uppercase tracking-[.1em] text-black/35"><tr><th className="py-3">Customer</th><th>Currency</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Profit</th><th className="text-right">Margin</th></tr></thead><tbody className="divide-y divide-black/8">{topCustomers.length ? topCustomers.map((row) => <tr key={`${row.customer_id}-${row.currency}`}><td className="py-3"><strong>{row.customer_name}</strong>{row.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(row.customer_id)}`} className="ml-2 text-[9px] font-black text-[#b78a3e]">360°</Link> : null}<p className="mt-1 text-[9px] text-black/35">{row.shipment_count} jobs · {row.invoice_count} invoices</p></td><td>{row.currency}</td><td className="text-right">{money(row.revenue, row.currency)}</td><td className="text-right">{money(row.cost, row.currency)}</td><td className={`text-right font-black ${row.profit < 0 ? "text-rose-700" : "text-emerald-700"}`}>{money(row.profit, row.currency)}</td><td className="text-right">{percentage(row.margin_percent)}</td></tr>) : <tr><td colSpan={6} className="py-8 text-center text-black/35">No customer P&L yet.</td></tr>}</tbody></table></div></TablePanel>

        <TablePanel eyebrow="Routes" title="Lane & mode profitability" detail="See where freight economics are working, by currency."><div className="space-y-2">{topRoutes.length ? topRoutes.map((row) => <div key={`${row.origin}-${row.destination}-${row.mode}-${row.currency}`} className="rounded-2xl border border-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Route size={13} className="text-[#b78a3e]"/><strong className="text-sm">{row.origin} → {row.destination}</strong></div><p className="mt-1 text-[9px] text-black/40">{row.mode} · {row.jobs} jobs · {row.currency}</p></div><div className="text-right"><strong className={row.profit < 0 ? "text-rose-700" : "text-emerald-700"}>{money(row.profit, row.currency)}</strong><p className="mt-1 text-[9px] text-black/40">{percentage(row.margin_percent)} margin</p></div></div></div>) : <Empty text="No route profitability yet."/>}</div></TablePanel>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><SectionHeading eyebrow="Trend" title="Monthly revenue vs recognised cost" detail="The chart never combines currencies."/><div className="mt-6 grid gap-5 xl:grid-cols-2">{trendCurrencies.length ? trendCurrencies.map((currency) => <TrendChart key={currency} currency={currency} points={analytics.trends.filter((item) => item.currency === currency).slice(-12)}/>) : <Empty text="No monthly trend data yet."/>}</div></section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TablePanel eyebrow="Exception P&L" title="Loss-making jobs" detail="Jobs with recognised cost above invoiced revenue in the selected period.">{lossJobs.length ? <div className="space-y-2">{lossJobs.map((job) => <Link key={`${job.shipment_reference}-${job.currency}`} href={`/admin/jobs/${encodeURIComponent(job.shipment_reference)}/profitability`} className="block rounded-2xl border border-rose-100 bg-rose-50/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm">{job.shipment_reference}</strong><p className="mt-1 text-[9px] text-black/45">{job.customer_name} · {job.origin} → {job.destination} · {job.branch}</p></div><div className="text-right"><strong className="text-rose-700">{money(job.profit, job.currency)}</strong><p className="mt-1 text-[9px] text-black/40">{percentage(job.margin_percent)} margin</p></div></div></Link>)}</div> : <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-800">No loss-making jobs in this range. ✦</div>}</TablePanel>

        <TablePanel eyebrow="People" title="Staff workload" detail="Open jobs, urgent jobs and task pressure from Digital Job Files."><div className="space-y-2">{workload.length ? workload.map((row) => <div key={row.staff_email || row.staff_name} className="rounded-2xl border border-black/10 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#10263f] text-xs font-black text-white">{row.staff_name.slice(0, 1).toUpperCase()}</span><div><strong className="text-sm">{row.staff_name}</strong><p className="mt-1 text-[9px] text-black/35">{row.staff_email || "No email assigned"}</p></div></div><div className="text-right text-[9px] font-black"><p>{row.active_jobs} jobs · {row.open_tasks} tasks</p><p className={row.overdue_tasks || row.urgent_jobs ? "mt-1 text-rose-700" : "mt-1 text-black/35"}>{row.urgent_jobs} urgent · {row.overdue_tasks} overdue</p></div></div></div>) : <Empty text="No staff workload data yet."/>}</div></TablePanel>
      </section>

      <section className="grid gap-4 md:grid-cols-3"><SummaryCard title="Quote pipeline" icon={<Target size={16}/>} main={`${analytics.quote_won} won / ${analytics.quote_total} created`} detail={`${analytics.quote_lost} lost · ${analytics.quote_conversion_percent.toFixed(1)}% won rate`}/><SummaryCard title="Operational throughput" icon={<BriefcaseBusiness size={16}/>} main={`${analytics.active_shipments} active jobs`} detail={`${analytics.delivered_in_period} delivered in selected range`}/><SummaryCard title="Management scope" icon={<Building2 size={16}/>} main={`${analytics.customers.length} customer/currency P&Ls`} detail={`${analytics.jobs.length} job/currency P&Ls analysed`}/></section>
    </div>
  </main>;
}

function HeroMetric({ label, value, icon, danger = false }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) { return <div className={`rounded-2xl border p-4 ${danger ? "border-rose-300/25 bg-rose-400/10" : "border-white/10 bg-white/[.035]"}`}><div className={`flex items-center gap-2 ${danger ? "text-rose-200" : "text-white/35"}`}>{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{label}</span></div><p className={`mt-2 text-2xl font-black ${danger ? "text-rose-100" : "text-white"}`}>{value}</p></div>; }
function MoneyMini({ label, value, icon, warn = false }: { label: string; value: string; icon: React.ReactNode; warn?: boolean }) { return <div className={`rounded-xl border p-3 ${warn ? "border-rose-200 bg-rose-50" : "border-black/8 bg-[#faf9f5]"}`}><div className="flex items-center gap-1.5 text-black/30">{icon}<span className="text-[8px] font-black uppercase tracking-[.1em]">{label}</span></div><p className={`mt-1 text-xs font-black ${warn ? "text-rose-700" : ""}`}>{value}</p></div>; }
function SectionHeading({ eyebrow, title, detail, inverse = false }: { eyebrow: string; title: string; detail: string; inverse?: boolean }) { return <div><p className={`text-[9px] font-black uppercase tracking-[.16em] ${inverse ? "text-[#d4ad62]" : "text-[#b78a3e]"}`}>{eyebrow}</p><h2 className={`mt-1 text-2xl font-black tracking-[-.035em] ${inverse ? "text-white" : ""}`}>{title}</h2><p className={`mt-2 text-xs leading-5 ${inverse ? "text-white/40" : "text-black/45"}`}>{detail}</p></div>; }
function TablePanel({ eyebrow, title, detail, children }: { eyebrow: string; title: string; detail: string; children: React.ReactNode }) { return <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><SectionHeading eyebrow={eyebrow} title={title} detail={detail}/><div className="mt-5">{children}</div></section>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl bg-[#faf9f5] p-5 text-xs text-black/40">{text}</div>; }
function SummaryCard({ title, main, detail, icon }: { title: string; main: string; detail: string; icon: React.ReactNode }) { return <div className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-[#b78a3e]">{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{title}</span></div><p className="mt-3 text-xl font-black">{main}</p><p className="mt-2 text-xs text-black/40">{detail}</p></div>; }

function TrendChart({ currency, points }: { currency: CrmCurrency; points: TrendPoint[] }) {
  const maximum = Math.max(1, ...points.flatMap((point) => [point.revenue, point.cost]));
  return <div className="rounded-[24px] bg-[#10263f] p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-[8px] font-black uppercase tracking-[.12em] text-[#d4ad62]">{currency}</p><h3 className="mt-1 text-sm font-black">12-month movement</h3></div><div className="flex gap-3 text-[8px] font-black uppercase text-white/35"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#d4ad62]"/>Revenue</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-white/35"/>Cost</span></div></div><div className="mt-5 flex min-h-40 items-end gap-2 overflow-x-auto pb-1">{points.map((point) => <div key={`${point.month}-${point.currency}`} className="flex min-w-12 flex-1 flex-col items-center"><div className="flex h-28 w-full items-end justify-center gap-1"><div title={`Revenue ${money(point.revenue, currency)}`} className="w-2.5 rounded-t bg-[#d4ad62]" style={{ height: `${Math.max(point.revenue ? 4 : 0, (point.revenue / maximum) * 100)}%` }}/><div title={`Cost ${money(point.cost, currency)}`} className="w-2.5 rounded-t bg-white/35" style={{ height: `${Math.max(point.cost ? 4 : 0, (point.cost / maximum) * 100)}%` }}/></div><span className="mt-2 text-[7px] font-black text-white/30">{point.month.slice(5)}</span></div>)}</div></div>;
}
