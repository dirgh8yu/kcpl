"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CircleDollarSign, Clock3, FilePlus2, Landmark, Search, TriangleAlert, WalletCards } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { financeInvoiceStatusLabels, financeInvoiceStatuses, type FinanceDashboard, type FinanceInvoiceStatus } from "./finance-data";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

const statusStyle: Record<FinanceInvoiceStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  issued: "border-sky-200 bg-sky-50 text-sky-700",
  partially_paid: "border-violet-200 bg-violet-50 text-violet-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  void: "border-black/10 bg-black/5 text-black/40",
};

export function FinanceWorkspace({ dashboard, roleLabel }: { dashboard: FinanceDashboard; roleLabel: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | FinanceInvoiceStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ shipmentReference: "", customerId: "", issueDate: today, dueDate: "", currency: "NPR" as CrmCurrency, description: "", amount: "", taxRate: "0", notes: "" });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.invoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      if (!needle) return true;
      return [invoice.reference, invoice.customer_name, invoice.customer_id, invoice.shipment_reference ?? "", invoice.quote_reference ?? "", invoice.branch, invoice.currency]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.invoices, query, status]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/finance/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount), taxRate: Number(form.taxRate) }) });
      const data = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Invoice could not be created.");
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
    <header className="bg-[#091624] px-5 py-6 text-white lg:px-8">
      <div className="mx-auto flex max-w-[1700px] flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4"><Link href="/admin" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Finance</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Accounts Receivable</h1><p className="mt-2 text-xs text-white/45">Invoices, collections, aging and customer credit · {roleLabel}</p></div></div>
        <button type="button" onClick={() => setCreateOpen((value) => !value)} className="flex items-center gap-2 rounded-xl bg-[#d4ad62] px-4 py-3 text-xs font-black text-[#10263f]"><FilePlus2 size={15}/>{createOpen ? "Close invoice form" : "New invoice"}</button>
      </div>
    </header>

    <section className="bg-[#10263f] px-5 pb-6 text-white lg:px-8"><div className="mx-auto grid max-w-[1700px] grid-cols-2 gap-3 md:grid-cols-4">
      <Metric label="Overdue invoices" value={String(dashboard.overdue_count)} icon={<TriangleAlert size={15}/>} danger={dashboard.overdue_count > 0}/>
      <Metric label="Open receivables" value={String(dashboard.unpaid_count)} icon={<Clock3 size={15}/>}/>
      <Metric label="Paid invoices" value={String(dashboard.paid_count)} icon={<Banknote size={15}/>} accent/>
      <Metric label="Draft invoices" value={String(dashboard.draft_count)} icon={<WalletCards size={15}/>}/>
    </div></section>

    <div className="mx-auto max-w-[1700px] space-y-6 p-5 lg:p-8">
      {notice ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{notice}</div> : null}
      {createOpen ? <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="mb-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b78a3e]">Create receivable</p><h2 className="mt-1 text-2xl font-black">New invoice draft</h2><p className="mt-2 text-xs text-black/45">Link a shipment where possible. If there is no shipment yet, enter the CRM customer reference instead.</p></div><form onSubmit={createInvoice} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Shipment reference"><input className="fin-input" value={form.shipmentReference} onChange={(event) => setForm({ ...form, shipmentReference: event.target.value })} placeholder="KCPL-S-..."/></Field>
        <Field label="Customer reference"><input className="fin-input" value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="KCPL-C-..."/></Field>
        <Field label="Issue date"><input required type="date" className="fin-input" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></Field>
        <Field label="Due date"><input type="date" className="fin-input" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field>
        <Field label="Currency"><select className="fin-input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
        <Field label="Amount before tax"><input required min="0.01" step="0.01" type="number" className="fin-input" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field>
        <Field label="Tax %"><input min="0" max="100" step="0.01" type="number" className="fin-input" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field>
        <Field label="Description"><input className="fin-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Freight and logistics services"/></Field>
        <div className="md:col-span-2 xl:col-span-4"><Field label="Invoice notes"><textarea className="fin-input min-h-20 resize-y" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div>
        <div className="md:col-span-2 xl:col-span-4"><button disabled={busy} className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Creating…" : "Create invoice draft"}</button></div>
      </form></section> : null}

      <section className="grid gap-4 xl:grid-cols-2">{dashboard.currency_summaries.length ? dashboard.currency_summaries.map((summary) => <div key={summary.currency} className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#b78a3e]">{summary.currency} receivables</p><h2 className="mt-1 text-xl font-black">{money(summary.outstanding, summary.currency)} outstanding</h2></div><CircleDollarSign size={22} className="text-[#b78a3e]"/></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Invoiced" value={money(summary.invoiced, summary.currency)}/><Mini label="Collected" value={money(summary.collected, summary.currency)}/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} warn={summary.overdue > 0}/></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Age label="0–30 days" value={summary.aging_0_30} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} currency={summary.currency}/></div></div>) : <div className="rounded-[26px] border border-black/10 bg-white p-8 text-sm text-black/45">No issued invoices yet. Create the first invoice draft to start Accounts Receivable.</div>}</section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b78a3e]">Invoice register</p><h2 className="mt-1 text-2xl font-black">Receivables ledger</h2><p className="mt-1 text-xs text-black/45">{filtered.length} of {dashboard.invoices.length} invoices shown.</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#faf9f5] px-3"><Search size={13} className="text-black/30"/><input className="bg-transparent py-2.5 text-xs outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, customer, job…"/></label><select className="rounded-xl border border-black/10 bg-[#faf9f5] px-3 py-2.5 text-xs font-bold" value={status} onChange={(event) => setStatus(event.target.value as "all" | FinanceInvoiceStatus)}><option value="all">All statuses</option>{financeInvoiceStatuses.map((item) => <option key={item} value={item}>{financeInvoiceStatusLabels[item]}</option>)}</select></div></div>
        <div className="overflow-x-auto rounded-2xl border border-black/10"><table className="min-w-[1050px] w-full text-left text-xs"><thead className="bg-[#f7f5ee] text-[9px] font-black uppercase tracking-[.1em] text-black/35"><tr><th className="px-4 py-3">Invoice</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Job / branch</th><th className="px-3 py-3">Issued / due</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-black/10">{filtered.length ? filtered.map((invoice) => <tr key={invoice.reference} className="hover:bg-[#faf9f5]"><td className="px-4 py-4"><Link href={`/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`} className="font-black text-[#10263f] underline-offset-4 hover:underline">{invoice.reference}</Link></td><td className="px-3 py-4"><strong>{invoice.customer_name}</strong><p className="mt-1 text-[9px] text-black/35">{invoice.customer_id}</p></td><td className="px-3 py-4"><span>{invoice.shipment_reference || "No shipment"}</span><p className="mt-1 flex items-center gap-1 text-[9px] text-black/35"><Landmark size={9}/>{invoice.branch}</p></td><td className="px-3 py-4"><span>{dateLabel(invoice.issue_date)}</span><p className={`mt-1 text-[9px] ${invoice.status === "overdue" ? "font-black text-rose-600" : "text-black/35"}`}>Due {dateLabel(invoice.due_date)}</p></td><td className="px-3 py-4 font-black">{money(invoice.total, invoice.currency)}</td><td className={`px-3 py-4 font-black ${invoice.balance_due > 0 ? "text-[#10263f]" : "text-emerald-700"}`}>{money(invoice.balance_due, invoice.currency)}</td><td className="px-3 py-4"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${statusStyle[invoice.status]}`}>{financeInvoiceStatusLabels[invoice.status]}</span></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-black/40">No invoices match the current filters.</td></tr>}</tbody></table></div>
      </section>
    </div>
    <style jsx global>{`.fin-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.75rem;background:#faf9f5;padding:.75rem;font-size:.8rem;outline:none}.fin-input:focus{border-color:#b78a3e;background:white}`}</style>
  </main>;
}

function Metric({ label, value, icon, accent = false, danger = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean; danger?: boolean }) {
  const style = danger ? "border-rose-300/30 bg-rose-400/10 text-rose-100" : accent ? "border-[#d4ad62]/35 bg-[#d4ad62]/10 text-[#e0bd79]" : "border-white/10 bg-white/[.035] text-white";
  return <div className={`rounded-2xl border p-4 ${style}`}><div className="flex items-center gap-2 opacity-55">{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{label}</span></div><p className="mt-2 text-2xl font-black">{value}</p></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-black/40">{label}</span>{children}</label>; }
function Mini({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className={`rounded-xl border p-3 ${warn ? "border-rose-200 bg-rose-50" : "border-black/8 bg-[#faf9f5]"}`}><p className="text-[8px] font-black uppercase tracking-[.1em] text-black/35">{label}</p><p className={`mt-1 text-xs font-black ${warn ? "text-rose-700" : ""}`}>{value}</p></div>; }
function Age({ label, value, currency }: { label: string; value: number; currency: string }) { return <div className="rounded-xl bg-[#10263f] p-3 text-white"><p className="text-[8px] font-black uppercase tracking-[.1em] text-white/40">{label}</p><p className={`mt-1 text-xs font-black ${value ? "text-[#e0bd79]" : "text-white/45"}`}>{money(value, currency)}</p></div>; }
