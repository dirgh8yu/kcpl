"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, BriefcaseBusiness, CircleDollarSign, Clock3, FilePlus2, Search, TriangleAlert, WalletCards } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { jobCostCategories, jobCostCategoryLabels, type JobCostCategory } from "../job-file";
import { payableStatusLabels, payableStatuses, type PayablesDashboard, type PayableStatus } from "./payables-data";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

const statusStyle: Record<PayableStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  approved: "border-sky-200 bg-sky-50 text-sky-700",
  partially_paid: "border-violet-200 bg-violet-50 text-violet-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  void: "border-black/10 bg-black/5 text-black/40",
};

export function PayablesWorkspace({ dashboard, roleLabel, initialShipment = "" }: { dashboard: PayablesDashboard; roleLabel: string; initialShipment?: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | PayableStatus>("all");
  const [createOpen, setCreateOpen] = useState(Boolean(initialShipment));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    shipmentReference: initialShipment,
    supplierId: "",
    supplierName: "",
    supplierBillReference: "",
    billDate: today,
    dueDate: "",
    currency: "NPR" as CrmCurrency,
    category: "freight" as JobCostCategory,
    description: "Freight / logistics supplier cost",
    amount: "",
    taxRate: "0",
    notes: "",
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.bills.filter((bill) => {
      if (status !== "all" && bill.status !== status) return false;
      if (!needle) return true;
      return [bill.reference, bill.supplier_name, bill.supplier_bill_reference ?? "", bill.shipment_reference ?? "", bill.branch, bill.currency]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.bills, query, status]);

  async function createBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/payables/bills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), taxRate: Number(form.taxRate) }),
      });
      const data = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Supplier bill could not be created.");
      router.push(`/admin/payables/bills/${encodeURIComponent(data.reference)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Supplier bill could not be created.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
    <header className="bg-[#091624] px-5 py-6 text-white lg:px-8"><div className="mx-auto flex max-w-[1700px] flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><Link href="/admin/finance" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Finance</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Accounts Payable</h1><p className="mt-2 text-xs text-white/45">Supplier bills, payments, aging and job costs · {roleLabel}</p></div></div><button type="button" onClick={() => setCreateOpen((value) => !value)} className="flex items-center gap-2 rounded-xl bg-[#d4ad62] px-4 py-3 text-xs font-black text-[#10263f]"><FilePlus2 size={15}/>{createOpen ? "Close bill form" : "New supplier bill"}</button></div></header>

    <section className="bg-[#10263f] px-5 pb-6 text-white lg:px-8"><div className="mx-auto grid max-w-[1700px] grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Overdue bills" value={String(dashboard.overdue_count)} icon={<TriangleAlert size={15}/>} danger={dashboard.overdue_count > 0}/><Metric label="Open payables" value={String(dashboard.unpaid_count)} icon={<Clock3 size={15}/>}/><Metric label="Paid bills" value={String(dashboard.paid_count)} icon={<Banknote size={15}/>} accent/><Metric label="Draft bills" value={String(dashboard.draft_count)} icon={<WalletCards size={15}/>}/></div></section>

    <div className="mx-auto max-w-[1700px] space-y-6 p-5 lg:p-8">
      {notice ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{notice}</div> : null}
      {createOpen ? <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="mb-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b78a3e]">Create payable</p><h2 className="mt-1 text-2xl font-black">New supplier bill</h2><p className="mt-2 text-xs text-black/45">Link a shipment to make this bill part of the Job File cost and profitability trail after approval.</p></div><form onSubmit={createBill} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Shipment reference"><input className="ap-input" value={form.shipmentReference} onChange={(event) => setForm({ ...form, shipmentReference: event.target.value })} placeholder="KCPL-S-..."/></Field>
        <Field label="Supplier CRM reference"><input className="ap-input" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} placeholder="Optional KCPL-C-..."/></Field>
        <Field label="Supplier / carrier name"><input className="ap-input" value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} placeholder="Carrier, agent, transporter…"/></Field>
        <Field label="Supplier bill reference"><input className="ap-input" value={form.supplierBillReference} onChange={(event) => setForm({ ...form, supplierBillReference: event.target.value })} placeholder="Vendor invoice / bill no."/></Field>
        <Field label="Bill date"><input required type="date" className="ap-input" value={form.billDate} onChange={(event) => setForm({ ...form, billDate: event.target.value })}/></Field>
        <Field label="Due date"><input type="date" className="ap-input" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field>
        <Field label="Cost category"><select className="ap-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((item) => <option key={item} value={item}>{jobCostCategoryLabels[item]}</option>)}</select></Field>
        <Field label="Currency"><select className="ap-input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
        <Field label="Amount before tax"><input required min="0.01" step="0.01" type="number" className="ap-input" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field>
        <Field label="Tax %"><input min="0" max="100" step="0.01" type="number" className="ap-input" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field>
        <div className="md:col-span-2"><Field label="Description"><input className="ap-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></Field></div>
        <div className="md:col-span-2 xl:col-span-4"><Field label="Notes"><textarea className="ap-input min-h-20 resize-y" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div>
        <div className="md:col-span-2 xl:col-span-4"><button disabled={busy} className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Creating…" : "Create bill draft"}</button></div>
      </form></section> : null}

      <section className="grid gap-4 xl:grid-cols-2">{dashboard.currency_summaries.length ? dashboard.currency_summaries.map((summary) => <div key={summary.currency} className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#b78a3e]">{summary.currency} payables</p><h2 className="mt-1 text-xl font-black">{money(summary.outstanding, summary.currency)} outstanding</h2></div><CircleDollarSign size={22} className="text-[#b78a3e]"/></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Billed" value={money(summary.billed, summary.currency)}/><Mini label="Paid" value={money(summary.paid, summary.currency)}/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} warn={summary.overdue > 0}/></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Age label="0–30 days" value={summary.aging_0_30} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} currency={summary.currency}/></div></div>) : <div className="rounded-[26px] border border-black/10 bg-white p-8 text-sm text-black/45">No approved supplier bills yet.</div>}</section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b78a3e]">Payables register</p><h2 className="mt-1 text-2xl font-black">Supplier bill ledger</h2><p className="mt-1 text-xs text-black/45">{filtered.length} of {dashboard.bills.length} bills shown.</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#faf9f5] px-3"><Search size={13} className="text-black/30"/><input className="bg-transparent py-2.5 text-xs outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier, bill, job…"/></label><select className="rounded-xl border border-black/10 bg-[#faf9f5] px-3 py-2.5 text-xs font-bold" value={status} onChange={(event) => setStatus(event.target.value as "all" | PayableStatus)}><option value="all">All statuses</option>{payableStatuses.map((item) => <option key={item} value={item}>{payableStatusLabels[item]}</option>)}</select></div></div>
        <div className="overflow-x-auto rounded-2xl border border-black/10"><table className="min-w-[1100px] w-full text-left text-xs"><thead className="bg-[#f7f5ee] text-[9px] font-black uppercase tracking-[.1em] text-black/35"><tr><th className="px-4 py-3">Bill</th><th className="px-3 py-3">Supplier</th><th className="px-3 py-3">Job / branch</th><th className="px-3 py-3">Bill / due</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-black/10">{filtered.length ? filtered.map((bill) => <tr key={bill.reference} className="hover:bg-[#faf9f5]"><td className="px-4 py-4"><Link href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`} className="font-black underline-offset-4 hover:underline">{bill.reference}</Link><p className="mt-1 text-[9px] text-black/35">{bill.supplier_bill_reference || "No vendor ref"}</p></td><td className="px-3 py-4"><strong>{bill.supplier_name}</strong><p className="mt-1 text-[9px] text-black/35">{jobCostCategoryLabels[bill.category]}</p></td><td className="px-3 py-4"><span>{bill.shipment_reference || "General payable"}</span><p className="mt-1 flex items-center gap-1 text-[9px] text-black/35"><BriefcaseBusiness size={9}/>{bill.branch}</p></td><td className="px-3 py-4"><span>{dateLabel(bill.bill_date)}</span><p className={`mt-1 text-[9px] ${bill.status === "overdue" ? "font-black text-rose-600" : "text-black/35"}`}>Due {dateLabel(bill.due_date)}</p></td><td className="px-3 py-4 font-black">{money(bill.total, bill.currency)}</td><td className="px-3 py-4 font-black">{money(bill.balance_due, bill.currency)}</td><td className="px-3 py-4"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${statusStyle[bill.status]}`}>{payableStatusLabels[bill.status]}</span></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-black/40">No supplier bills match the current filters.</td></tr>}</tbody></table></div>
      </section>
    </div>
    <style jsx global>{`.ap-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.75rem;background:#faf9f5;padding:.75rem;font-size:.8rem;outline:none}.ap-input:focus{border-color:#b78a3e;background:white}`}</style>
  </main>;
}

function Metric({ label, value, icon, accent = false, danger = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean; danger?: boolean }) { const style = danger ? "border-rose-300/30 bg-rose-400/10 text-rose-100" : accent ? "border-[#d4ad62]/35 bg-[#d4ad62]/10 text-[#e0bd79]" : "border-white/10 bg-white/[.035] text-white"; return <div className={`rounded-2xl border p-4 ${style}`}><div className="flex items-center gap-2 opacity-55">{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{label}</span></div><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-black/40">{label}</span>{children}</label>; }
function Mini({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className={`rounded-xl border p-3 ${warn ? "border-rose-200 bg-rose-50" : "border-black/8 bg-[#faf9f5]"}`}><p className="text-[8px] font-black uppercase tracking-[.1em] text-black/35">{label}</p><p className={`mt-1 text-xs font-black ${warn ? "text-rose-700" : ""}`}>{value}</p></div>; }
function Age({ label, value, currency }: { label: string; value: number; currency: string }) { return <div className="rounded-xl bg-[#10263f] p-3 text-white"><p className="text-[8px] font-black uppercase tracking-[.1em] text-white/40">{label}</p><p className={`mt-1 text-xs font-black ${value ? "text-[#e0bd79]" : "text-white/45"}`}>{money(value, currency)}</p></div>; }
