"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, BriefcaseBusiness, Building2, CheckCircle2, CircleDollarSign, FileText, Printer, ReceiptText, Trash2 } from "lucide-react";
import { financeInvoiceStatusLabels, financePaymentMethodLabels, financePaymentMethods, type FinanceInvoice, type FinancePaymentMethod } from "../../finance-data";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

export function InvoiceWorkspace({ invoice, roleLabel }: { invoice: FinanceInvoice; roleLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [payment, setPayment] = useState({ amount: invoice.balance_due ? String(invoice.balance_due) : "", paymentDate: today, method: "bank_transfer" as FinancePaymentMethod, reference: "", notes: "" });

  async function invoiceAction(action: "issue" | "void") {
    if (action === "void" && !window.confirm(`Void ${invoice.reference}? This keeps the audit trail but removes the receivable.`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Invoice action failed.");
      setNotice(action === "issue" ? "Invoice issued." : "Invoice voided.");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Invoice action failed."); }
    finally { setBusy(false); }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}/payments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payment, amount: Number(payment.amount) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Payment could not be recorded.");
      setNotice("Payment recorded and customer receivables recalculated.");
      setPayment((current) => ({ ...current, amount: "", reference: "", notes: "" }));
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Payment could not be recorded."); }
    finally { setBusy(false); }
  }

  const canPay = ["issued", "partially_paid", "overdue"].includes(invoice.status) && invoice.balance_due > 0;
  return <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
    <header className="no-print bg-[#091624] px-5 py-6 text-white lg:px-8"><div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><Link href="/admin/finance" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Finance</p><h1 className="mt-1 text-2xl font-black">{invoice.reference}</h1><p className="mt-1 text-xs text-white/45">{invoice.customer_name} · {roleLabel}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-black"><Printer size={14}/>Print</button>{invoice.status === "draft" ? <button disabled={busy} onClick={() => invoiceAction("issue")} className="rounded-xl bg-[#d4ad62] px-4 py-2.5 text-xs font-black text-[#10263f]">Issue invoice</button> : null}{invoice.status !== "void" && invoice.amount_paid === 0 ? <button disabled={busy} onClick={() => invoiceAction("void")} className="flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-2.5 text-xs font-black text-rose-100"><Trash2 size={13}/>Void</button> : null}</div></div></header>

    <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
      {notice ? <div className="no-print mb-5 rounded-2xl border border-[#d4ad62]/30 bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6d5427]">{notice}</div> : null}
      <section className="invoice-sheet overflow-hidden rounded-[30px] border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 p-7 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-8"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">Kapileshwor Cargo Pvt. Ltd.</p><h2 className="mt-2 text-4xl font-black tracking-[-.05em]">INVOICE</h2><p className="mt-3 text-xs leading-5 text-black/45">Pragatipath Finance Complex, 2nd Floor<br/>Mhepi Road, Sorakhutte, Kathmandu, Nepal</p></div><div className="min-w-[260px] text-sm"><Info label="Invoice" value={invoice.reference}/><Info label="Issue date" value={dateLabel(invoice.issue_date)}/><Info label="Due date" value={dateLabel(invoice.due_date)}/><Info label="Status" value={financeInvoiceStatusLabels[invoice.status]}/></div></div></div>
        <div className="grid gap-0 border-b border-black/10 md:grid-cols-2"><div className="p-7 sm:p-10"><p className="text-[9px] font-black uppercase tracking-[.14em] text-black/35">Bill to</p><h3 className="mt-2 text-xl font-black">{invoice.customer_name}</h3><p className="mt-2 text-xs text-black/45">Customer reference: {invoice.customer_id}</p></div><div className="border-t border-black/10 p-7 sm:p-10 md:border-l md:border-t-0"><p className="text-[9px] font-black uppercase tracking-[.14em] text-black/35">Operational reference</p><p className="mt-2 text-sm font-black">{invoice.shipment_reference || "No shipment linked"}</p><p className="mt-2 text-xs text-black/45">Quote: {invoice.quote_reference || "Not linked"} · Branch: {invoice.branch}</p></div></div>
        <div className="p-7 sm:p-10"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b-2 border-[#10263f] text-[9px] font-black uppercase tracking-[.12em] text-black/40"><tr><th className="py-3">Description</th><th className="py-3 text-right">Qty</th><th className="py-3 text-right">Unit price</th><th className="py-3 text-right">Tax</th><th className="py-3 text-right">Total</th></tr></thead><tbody>{invoice.line_items.map((line) => <tr key={line.id} className="border-b border-black/10"><td className="py-5 pr-4 font-bold">{line.description}</td><td className="py-5 text-right">{line.quantity}</td><td className="py-5 text-right">{money(line.unit_price, invoice.currency)}</td><td className="py-5 text-right">{line.tax_rate}%</td><td className="py-5 text-right font-black">{money(line.total, invoice.currency)}</td></tr>)}</tbody></table></div>
          <div className="ml-auto mt-7 max-w-sm space-y-3 text-sm"><Total label="Subtotal" value={money(invoice.subtotal, invoice.currency)}/><Total label="Tax" value={money(invoice.tax_total, invoice.currency)}/><div className="border-t-2 border-[#10263f] pt-3"><Total label="Invoice total" value={money(invoice.total, invoice.currency)} strong/></div><Total label="Paid" value={money(invoice.amount_paid, invoice.currency)}/><div className={`rounded-xl px-4 py-3 ${invoice.balance_due > 0 ? "bg-[#10263f] text-white" : "bg-emerald-50 text-emerald-800"}`}><Total label="Balance due" value={money(invoice.balance_due, invoice.currency)} strong/></div></div>
          {invoice.notes ? <div className="mt-8 rounded-2xl bg-[#faf9f5] p-4 text-xs leading-6 text-black/55"><strong className="text-[#10263f]">Notes</strong><br/>{invoice.notes}</div> : null}
        </div>
      </section>

      <div className="no-print mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#10263f] p-2.5 text-white"><ReceiptText size={16}/></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b78a3e]">Links</p><h3 className="mt-1 text-lg font-black">Connected records</h3></div></div><div className="mt-5 space-y-2"><Link href={`/admin/crm/${encodeURIComponent(invoice.customer_id)}`} className="flex items-center gap-2 rounded-xl border border-black/10 px-4 py-3 text-xs font-black"><Building2 size={14}/>Customer 360</Link>{invoice.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(invoice.shipment_reference)}`} className="flex items-center gap-2 rounded-xl border border-black/10 px-4 py-3 text-xs font-black"><BriefcaseBusiness size={14}/>Digital Job File</Link> : null}</div></section>
        <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#b78a3e] p-2.5 text-white"><Banknote size={16}/></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b78a3e]">Collections</p><h3 className="mt-1 text-lg font-black">Payments</h3></div></div><span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${invoice.balance_due > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{money(invoice.balance_due, invoice.currency)} due</span></div>
          {canPay ? <form onSubmit={recordPayment} className="mt-5 grid gap-3 rounded-2xl bg-[#faf9f5] p-4 sm:grid-cols-2"><Field label="Amount"><input required min="0.01" max={invoice.balance_due} step="0.01" type="number" className="inv-input" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></Field><Field label="Payment date"><input required type="date" className="inv-input" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></Field><Field label="Method"><select className="inv-input" value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></Field><Field label="Bank / receipt reference"><input className="inv-input" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></Field><div className="sm:col-span-2"><Field label="Notes"><input className="inv-input" value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></Field></div><div className="sm:col-span-2"><button disabled={busy} className="rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? "Recording…" : "Record payment"}</button></div></form> : null}
          <div className="mt-5 space-y-2">{invoice.payments.length ? invoice.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-4"><div><strong className="text-sm">{money(item.amount, item.currency)}</strong><p className="mt-1 text-[9px] text-black/40">{dateLabel(item.payment_date)} · {financePaymentMethodLabels[item.method]}{item.reference ? ` · ${item.reference}` : ""}</p></div><div className="flex items-center gap-1 text-[9px] font-black text-emerald-700"><CheckCircle2 size={12}/>Recorded</div></div>) : <p className="rounded-xl bg-[#faf9f5] p-4 text-xs text-black/40">No payments recorded yet.</p>}</div>
        </section>
      </div>
    </div>
    <style jsx global>{`.inv-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.75rem;background:white;padding:.7rem;font-size:.8rem;outline:none}.inv-input:focus{border-color:#b78a3e}@media print{.no-print{display:none!important}body{background:white!important}.invoice-sheet{box-shadow:none!important;border:0!important}.invoice-sheet{border-radius:0!important}}`}</style>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-6 border-b border-black/8 py-2"><span className="text-[9px] font-black uppercase tracking-[.1em] text-black/35">{label}</span><strong className="text-right text-xs">{value}</strong></div>; }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-5"><span className={strong ? "font-black" : "text-black/50"}>{label}</span><span className={strong ? "text-lg font-black" : "font-bold"}>{value}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.11em] text-black/40">{label}</span>{children}</label>; }
