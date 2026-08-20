import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, FileText, Landmark, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { getAdminAccess } from "../../../admin-auth";
import { getDigitalJobFile } from "../../../job-file.server";
import { jobCostCategoryLabels } from "../../../job-file";
import { listPayablesDashboard } from "../../../payables/payables.server";
import { payableStatusLabels } from "../../../payables/payables-data";
import { getStaffContext } from "../../../staff-directory.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Profitability | KCPL", robots: { index: false, follow: false } };

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

export default async function JobProfitabilityPage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Job profitability is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobCosts) return <Gate title="Profitability is restricted" detail="Your role can operate shipments, but commercial job-cost data is withheld."/>;
  const { reference } = await params;
  const result = await getDigitalJobFile(reference, staff);
  if (result.kind === "unavailable") return <Gate title="Profitability unavailable" detail="Firestore is unavailable for this deployment."/>;
  if (result.kind === "missing") return <Gate title="Shipment not found" detail="This shipment reference does not exist."/>;
  if (result.kind === "forbidden") return <Gate title="Outside your branch access" detail="This shipment belongs to a branch outside your staff profile."/>;

  const job = result.job;
  const payablesDashboard = staff.permissions.canManageFinance ? await listPayablesDashboard(staff) : null;
  const bills = payablesDashboard?.bills.filter((bill) => bill.shipment_reference === job.reference) ?? [];
  const currencies = [...new Set([
    ...Object.keys(job.revenue_totals),
    ...Object.keys(job.cost_totals),
  ])].sort();

  return <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
    <header className="bg-[#091624] px-5 py-6 text-white lg:px-8"><div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Commercial Control</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Job Profitability</h1><p className="mt-2 text-xs text-white/45">{job.reference} · {job.origin || "Origin"} → {job.destination || "Destination"}</p></div></div>{staff.permissions.canManageFinance ? <Link href={`/admin/payables?shipment=${encodeURIComponent(job.reference)}`} className="rounded-xl bg-[#d4ad62] px-4 py-3 text-xs font-black text-[#10263f]">Add supplier bill</Link> : null}</div></header>

    <div className="mx-auto max-w-[1500px] space-y-6 p-5 lg:p-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><InfoCard label="Customer" value={job.customer_name || "Not linked"} icon={<BadgeDollarSign size={16}/>}/><InfoCard label="Branch" value={job.primary_branch} icon={<Landmark size={16}/>}/><InfoCard label="Revenue currencies" value={String(Object.keys(job.revenue_totals).length)} icon={<TrendingUp size={16}/>}/><InfoCard label="Recognised cost items" value={String(job.costs.length)} icon={<WalletCards size={16}/>}/></section>

      <section className="rounded-[30px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b78a3e]">Commercial result</p><h2 className="mt-1 text-2xl font-black">Revenue → Cost → Gross profit</h2><p className="mt-2 text-xs text-black/45">No automatic FX conversion is applied. Profit and margin are kept honest by currency.</p></div>
        {currencies.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{currencies.map((currency) => {
          const revenue = job.revenue_totals[currency as keyof typeof job.revenue_totals] ?? 0;
          const cost = job.cost_totals[currency as keyof typeof job.cost_totals] ?? 0;
          const profit = job.profit_totals[currency as keyof typeof job.profit_totals] ?? revenue - cost;
          const margin = job.margin_percent[currency as keyof typeof job.margin_percent];
          return <div key={currency} className="rounded-[24px] border border-black/10 bg-[#faf9f5] p-5"><div className="flex items-center justify-between"><strong className="text-lg">{currency}</strong><span className={`rounded-full px-3 py-1 text-[9px] font-black ${profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{margin === undefined ? "Margin N/A" : `${margin.toFixed(2)}% margin`}</span></div><div className="mt-5 grid grid-cols-3 gap-2"><MoneyCell label="Revenue" value={money(revenue, currency)}/><MoneyCell label="Cost" value={money(cost, currency)}/><MoneyCell label="Gross profit" value={money(profit, currency)} positive={profit >= 0}/></div></div>;
        })}</div> : <div className="mt-6 rounded-2xl bg-[#faf9f5] p-6 text-sm text-black/45">No invoiced revenue or recognised job costs yet.</div>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#10263f] p-2.5 text-white"><WalletCards size={16}/></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b78a3e]">Cost ledger</p><h2 className="mt-1 text-xl font-black">Recognised job costs</h2></div></div><div className="mt-5 space-y-2">{job.costs.length ? job.costs.map((cost) => <div key={cost.id} className="rounded-xl border border-black/10 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black">{cost.label}</p><p className="mt-1 text-[9px] text-black/40">{jobCostCategoryLabels[cost.category]}{cost.vendor ? ` · ${cost.vendor}` : ""}</p>{cost.source_type === "payable" && cost.source_reference ? <Link href={`/admin/payables/bills/${encodeURIComponent(cost.source_reference)}`} className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-[#b78a3e]"><FileText size={10}/>AP {cost.source_reference}</Link> : <p className="mt-2 text-[9px] font-bold text-black/30">Manual Job File cost</p>}</div><strong className="text-sm">{money(cost.amount, cost.currency)}</strong></div></div>) : <p className="rounded-xl bg-[#faf9f5] p-4 text-xs text-black/40">No recognised costs yet.</p>}</div></section>

        <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#b78a3e] p-2.5 text-white"><TrendingDown size={16}/></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b78a3e]">Accounts Payable</p><h2 className="mt-1 text-xl font-black">Supplier bills for this job</h2></div></div>{staff.permissions.canManageFinance ? <div className="mt-5 space-y-2">{bills.length ? bills.map((bill) => <Link key={bill.reference} href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`} className="block rounded-xl border border-black/10 p-4 hover:bg-[#faf9f5]"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black">{bill.supplier_name}</p><p className="mt-1 text-[9px] text-black/40">{bill.reference} · {payableStatusLabels[bill.status]}</p></div><div className="text-right"><strong className="text-sm">{money(bill.total, bill.currency)}</strong><p className="mt-1 text-[9px] text-black/40">{money(bill.balance_due, bill.currency)} due</p></div></div></Link>) : <p className="rounded-xl bg-[#faf9f5] p-4 text-xs text-black/40">No supplier bills linked to this job.</p>}</div> : <div className="mt-5 rounded-xl bg-[#faf9f5] p-4 text-xs text-black/40">Supplier payment details are restricted to Management and Accounts.</div>}</section>
      </div>
    </div>
  </main>;
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-black/30">{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{label}</span></div><p className="mt-2 text-lg font-black">{value}</p></div>; }
function MoneyCell({ label, value, positive }: { label: string; value: string; positive?: boolean }) { return <div className="rounded-xl bg-white p-3"><p className="text-[8px] font-black uppercase tracking-[.1em] text-black/35">{label}</p><p className={`mt-1 text-xs font-black ${positive === false ? "text-rose-700" : positive === true ? "text-emerald-700" : ""}`}>{value}</p></div>; }
function Gate({ title, detail }: { title: string; detail: string }) { return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Job Profitability</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6"><Link href="/admin" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Operations</Link></div></section></main>; }
