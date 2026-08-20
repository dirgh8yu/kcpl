/* eslint-disable react/no-unknown-property */
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, BriefcaseBusiness, CheckCircle2, CircleDollarSign, Trash2 } from "lucide-react";
import { financePaymentMethodLabels, financePaymentMethods, type FinancePaymentMethod } from "../../../finance/finance-data";
import { jobCostCategoryLabels } from "../../../job-file";
import { payableStatusLabels, type PayableBill } from "../../payables-data";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

export function PayableWorkspace({ bill, roleLabel }: { bill: PayableBill; roleLabel: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState({ amount: bill.balance_due ? String(bill.balance_due) : "", paymentDate: today, method: "bank_transfer" as FinancePaymentMethod, reference: "", notes: "" });

  async function billAction(action: "approve" | "void") {
    if (action === "void" && !window.confirm(`Void ${bill.reference}? This keeps the audit trail and removes its linked Job File cost.`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/payables/bills/${encodeURIComponent(bill.reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Supplier bill action failed.");
      setNotice(action === "approve" ? "Supplier bill approved and Job File cost recognised." : "Supplier bill voided.");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier bill action failed."); }
    finally { setBusy(false); }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/payables/bills/${encodeURIComponent(bill.reference)}/payments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payment, amount: Number(payment.amount) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Supplier payment could not be recorded.");
      setNotice("Supplier payment recorded.");
      setPayment((current) => ({ ...current, amount: "", reference: "", notes: "" }));
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier payment could not be recorded."); }
    finally { setBusy(false); }
  }

  const canPay = ["approved", "partially_paid", "overdue"].includes(bill.status) && bill.balance_due > 0;

  return <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
    <header className="bg-[#091624] px-5 py-6 text-white lg:px-8"><div className="mx-auto flex max-w-[1450px] flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><Link href="/admin/payables" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Accounts Payable</p><h1 className="mt-1 text-2xl font-black">{bill.reference}</h1><p className="mt-1 text-xs text-white/45">{bill.supplier_name} · {roleLabel}</p></div></div><div className="flex flex-wrap gap-2">{bill.status === "draft" ? <button disabled={busy} onClick={() => billAction("approve")} className="rounded-xl bg-[#d4ad62] px-4 py-2.5 text-xs font-black text-[#10263f]">Approve bill</button> : null}{bill.status !== "void" && bill.amount_paid === 0 ? <button disabled={busy} onClick={() => billAction("void")} className="flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-2.5 text-xs font-black text-rose-100"><Trash2 size={13}/>Void</button> : null}</div></div></header>

    <div className="mx-auto max-w-[1450px] p-5 lg:p-8">
      {notice ? <div className="mb-5 rounded-2xl border border-[#d4ad62]/30 bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6d5427]">{notice}</div> : null}
      <section className="rounded-[30px] border border-black/10 bg-white p-7 shadow-sm sm:p-9"><div className="flex flex-wrap items-start justify-between gap-8"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#b78a3e]">Supplier / carrier</p><h2 className="mt-2 text-3xl font-black">{bill.supplier_name}</h2><p className="mt-2 text-xs text-black/45">Vendor reference: {bill.supplier_bill_reference || "Not supplied"}</p>{bill.supplier_id ? <p className="mt-1 text-[10px] text-black/35">CRM {bill.supplier_id}</p> : null}</div><div className="min-w-[280px] space-y-2"><Info label="Status" value={payableStatusLabels[bill.status]}/><Info label="Bill date" value={dateLabel(bill.bill_date)}/><Info label="Due date" value={dateLabel(bill.due_date)}/><Info label="Category" value={jobCostCategoryLabels[bill.category]}/><Info label="Branch" value={bill.branch}/></div></div>
        <div className="mt-8 grid gap-3 sm:grid-cols-4"><Metric label="Subtotal" value={money(bill.subtotal, bill.currency)}/><Metric label={`Tax ${bill.tax_rate}%`} value={money(bill.tax_total, bill.currency)}/><Metric label="Paid" value={money(bill.amount_paid, bill.currency)}/><Metric label="Balance due" value={money(bill.balance_due, bill.currency)} strong/></div>
        <div className="mt-6 rounded-2xl bg-[#faf9f5] p-5"><p className="text-[9px] font-black uppercase tracking-[.12em] text-black/35">Description</p><p className="mt-2 text-sm font-bold">{bill.description}</p>{bill.notes ? <p className="mt-3 text-xs leading-5 text-black/50">{bill.notes}</p> : null}</div>
        {bill.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(bill.shipment_reference)}`} className="mt-5 flex items-center gap-2 rounded-xl border border-black/10 px-4 py-3 text-xs font-black"><BriefcaseBusiness size={14}/>Open Digital Job File · {bill.shipment_reference}</Link> : null}
      </section>

      <section className="mt-6 rounded-[28px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#10263f] p-2.5 text-white"><Banknote size={16}/></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b78a3e]">Payments</p><h3 className="mt-1 text-lg font-black">Supplier settlement</h3></div></div><span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${bill.balance_due > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{money(bill.balance_due, bill.currency)} due</span></div>
        {bill.status === "draft" ? <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs text-sky-800">Approve this bill first. Approval recognises the cost in the linked Digital Job File.</div> : null}
        {canPay ? <form onSubmit={recordPayment} className="mt-5 grid gap-3 rounded-2xl bg-[#faf9f5] p-4 sm:grid-cols-2"><Field label="Amount"><input required min="0.01" max={bill.balance_due} step="0.01" type="number" className="pay-input" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></Field><Field label="Payment date"><input required type="date" className="pay-input" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></Field><Field label="Method"><select className="pay-input" value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></Field><Field label="Bank / receipt reference"><input className="pay-input" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></Field><div className="sm:col-span-2"><Field label="Notes"><input className="pay-input" value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></Field></div><div className="sm:col-span-2"><button disabled={busy} className="rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? "Recording…" : "Record supplier payment"}</button></div></form> : null}
        <div className="mt-5 space-y-2">{bill.payments.length ? bill.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-4"><div><strong className="text-sm">{money(item.amount, item.currency)}</strong><p className="mt-1 text-[9px] text-black/40">{dateLabel(item.payment_date)} · {financePaymentMethodLabels[item.method]}{item.reference ? ` · ${item.reference}` : ""}</p></div><div className="flex items-center gap-1 text-[9px] font-black text-emerald-700"><CheckCircle2 size={12}/>Recorded</div></div>) : <p className="rounded-xl bg-[#faf9f5] p-4 text-xs text-black/40">No supplier payments recorded yet.</p>}</div>
      </section>
    </div>
    <style jsx global>{`.pay-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.75rem;background:white;padding:.7rem;font-size:.8rem;outline:none}.pay-input:focus{border-color:#b78a3e}`}</style>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-6 border-b border-black/8 py-2"><span className="text-[9px] font-black uppercase tracking-[.1em] text-black/35">{label}</span><strong className="text-right text-xs">{value}</strong></div>; }
function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`rounded-2xl p-4 ${strong ? "bg-[#10263f] text-white" : "bg-[#faf9f5]"}`}><div className="flex items-center gap-2"><CircleDollarSign size={13} className={strong ? "text-[#d4ad62]" : "text-black/25"}/><span className={`text-[8px] font-black uppercase tracking-[.1em] ${strong ? "text-white/40" : "text-black/35"}`}>{label}</span></div><p className={`mt-2 text-sm font-black ${strong ? "text-[#e0bd79]" : ""}`}>{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.11em] text-black/40">{label}</span>{children}</label>; }
