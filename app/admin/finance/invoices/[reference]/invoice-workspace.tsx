"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, Building2, CheckCircle2, Printer, ReceiptText, Trash2 } from "lucide-react";
import { financeInvoiceStatusLabels, financePaymentMethodLabels, financePaymentMethods, type FinanceInvoice, type FinancePaymentMethod } from "../../finance-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: FinanceInvoice["status"]): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "issued") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

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
      setNotice(action === "issue" ? "Invoice issued." : "Invoice voided."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Invoice action failed."); }
    finally { setBusy(false); }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}/payments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payment, amount: Number(payment.amount) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Payment could not be recorded.");
      setNotice("Payment recorded and customer receivables recalculated."); setPayment((current) => ({ ...current, amount: "", reference: "", notes: "" })); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Payment could not be recorded."); }
    finally { setBusy(false); }
  }

  const canPay = ["issued", "partially_paid", "overdue"].includes(invoice.status) && invoice.balance_due > 0;

  return <OpsPage>
    <div className="no-print"><OpsPageHeader eyebrow="Accounts Receivable" title={<OpsMono>{invoice.reference}</OpsMono>} description={`${invoice.customer_name} · ${roleLabel}`} meta={<><OpsBadge tone={statusTone(invoice.status)} dot>{financeInvoiceStatusLabels[invoice.status]}</OpsBadge><span>Issued {dateLabel(invoice.issue_date)}</span><span>Due {dateLabel(invoice.due_date)}</span></>} actions={<><Link href="/admin/finance" className="ops-button" data-variant="secondary" data-size="md">Back to AR</Link><OpsButton variant="secondary" onClick={() => window.print()}><Printer size={13}/>Print</OpsButton>{invoice.status === "draft" ? <OpsButton variant="primary" disabled={busy} onClick={() => invoiceAction("issue")}>Issue invoice</OpsButton> : null}{invoice.status !== "void" && invoice.amount_paid === 0 ? <OpsButton variant="danger" disabled={busy} onClick={() => invoiceAction("void")}><Trash2 size={12}/>Void</OpsButton> : null}</>}/></div>

    <div className="ops-content-wide ops-stack">
      {notice ? <div className="no-print"><OpsNotice tone={notice.toLowerCase().includes("failed") || notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

      <section className="invoice-sheet overflow-hidden rounded-[18px] border border-[#e4ddd6] bg-white shadow-[0_14px_40px_rgba(78,59,45,.035)]">
        <div className="border-b border-[#ece5df] p-7 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-8"><div><p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#b8654f]">Kapileshwor Cargo Pvt. Ltd.</p><h2 className="mt-2 text-[36px] font-[740] tracking-[-.055em] text-[#342e2a]">Invoice</h2><p className="mt-3 text-[10px] leading-5 text-[#887e76]">Pragatipath Finance Complex, 2nd Floor<br/>Mhepi Road, Sorakhutte, Kathmandu, Nepal</p></div><div className="min-w-[260px] text-[10px]"><Info label="Invoice" value={invoice.reference} mono/><Info label="Issue date" value={dateLabel(invoice.issue_date)}/><Info label="Due date" value={dateLabel(invoice.due_date)}/><Info label="Status" value={financeInvoiceStatusLabels[invoice.status]}/></div></div></div>
        <div className="grid border-b border-[#ece5df] md:grid-cols-2"><div className="p-7 sm:p-10"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#9c928a]">Bill to</p><h3 className="mt-2 text-[19px] font-[730] tracking-[-.025em] text-[#443b35]">{invoice.customer_name}</h3><p className="mt-2 text-[9px] text-[#8f857d]">Customer <OpsMono>{invoice.customer_id}</OpsMono></p></div><div className="border-t border-[#ece5df] p-7 sm:p-10 md:border-l md:border-t-0"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#9c928a]">Operational reference</p><p className="mt-2 text-[11px] font-bold text-[#514840]">{invoice.shipment_reference ? <OpsMono>{invoice.shipment_reference}</OpsMono> : "No shipment linked"}</p><p className="mt-2 text-[9px] text-[#8f857d]">Quote {invoice.quote_reference ? <OpsMono>{invoice.quote_reference}</OpsMono> : "not linked"} · {invoice.branch}</p></div></div>
        <div className="p-7 sm:p-10"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[10px]"><thead className="border-b border-[#dcd3cc] text-[8px] font-bold uppercase tracking-[.1em] text-[#91877f]"><tr><th className="py-3">Description</th><th className="py-3 text-right">Qty</th><th className="py-3 text-right">Unit price</th><th className="py-3 text-right">Tax</th><th className="py-3 text-right">Total</th></tr></thead><tbody>{invoice.line_items.map((line) => <tr key={line.id} className="border-b border-[#eee7e1]"><td className="py-4 pr-4 font-semibold text-[#514840]">{line.description}</td><td className="py-4 text-right text-[#71675f]">{line.quantity}</td><td className="py-4 text-right text-[#71675f]">{money(line.unit_price, invoice.currency)}</td><td className="py-4 text-right text-[#71675f]">{line.tax_rate}%</td><td className="py-4 text-right font-bold text-[#514840]">{money(line.total, invoice.currency)}</td></tr>)}</tbody></table></div>
          <div className="ml-auto mt-7 max-w-sm space-y-3 text-[10px]"><Total label="Subtotal" value={money(invoice.subtotal, invoice.currency)}/><Total label="Tax" value={money(invoice.tax_total, invoice.currency)}/><div className="border-t border-[#dcd3cc] pt-3"><Total label="Invoice total" value={money(invoice.total, invoice.currency)} strong/></div><Total label="Paid" value={money(invoice.amount_paid, invoice.currency)}/><div className={`rounded-[12px] border px-4 py-3 ${invoice.balance_due > 0 ? "border-[#efcbbd] bg-[#fff3ee] text-[#9e5845]" : "border-[#d7e5d9] bg-[#f1f7f2] text-[#5e7864]"}`}><Total label="Balance due" value={money(invoice.balance_due, invoice.currency)} strong/></div></div>
          {invoice.notes ? <div className="mt-8 rounded-[13px] bg-[#faf7f4] p-4 text-[9px] leading-5 text-[#71675f]"><strong className="text-[#514840]">Notes</strong><br/>{invoice.notes}</div> : null}
        </div>
      </section>

      <div className="no-print ops-grid-main">
        <OpsSurface eyebrow="Connected records" title="Operational links"><div className="grid gap-2"><Link href={`/admin/crm/${encodeURIComponent(invoice.customer_id)}`} className="flex items-center gap-2 rounded-[11px] border border-[#e8e0d9] bg-[#faf7f4] px-3 py-3 text-[10px] font-bold text-[#5d544d] hover:bg-white"><Building2 size={13}/>Customer 360</Link>{invoice.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(invoice.shipment_reference)}`} className="flex items-center gap-2 rounded-[11px] border border-[#e8e0d9] bg-[#faf7f4] px-3 py-3 text-[10px] font-bold text-[#5d544d] hover:bg-white"><BriefcaseBusiness size={13}/>Digital Job File</Link> : null}</div></OpsSurface>
        <OpsSurface eyebrow="Collections" title="Payments" description={`${money(invoice.balance_due, invoice.currency)} currently due.`}>
          {canPay ? <form onSubmit={recordPayment} className="grid gap-3 rounded-[13px] border border-[#eae2dc] bg-[#faf7f4] p-4 sm:grid-cols-2"><OpsField label="Amount"><input required min="0.01" max={invoice.balance_due} step="0.01" type="number" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></OpsField><OpsField label="Payment date"><input required type="date" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></OpsField><OpsField label="Method"><select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField><OpsField label="Bank / receipt reference"><input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></OpsField><OpsField label="Notes" className="sm:col-span-2"><input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></OpsField><div className="sm:col-span-2"><OpsButton variant="primary" disabled={busy}><Banknote size={12}/>{busy ? "Recording…" : "Record payment"}</OpsButton></div></form> : null}
          <div className="mt-4 divide-y divide-[#eee7e1]">{invoice.payments.length ? invoice.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-[10px] text-[#514840]">{money(item.amount, item.currency)}</strong><p className="mt-1 text-[8px] text-[#948a82]">{dateLabel(item.payment_date)} · {financePaymentMethodLabels[item.method]}{item.reference ? ` · ${item.reference}` : ""}</p></div><OpsBadge tone="success"><CheckCircle2 size={10}/>Recorded</OpsBadge></div>) : <OpsEmptyState icon={<ReceiptText size={17}/>} title="No payments recorded" description="Payments will appear here with method, date and reference."/>}</div>
        </OpsSurface>
      </div>
    </div>
    <style jsx global>{`@media print{.no-print{display:none!important}body{background:white!important}.invoice-sheet{box-shadow:none!important;border:0!important;border-radius:0!important}.kcpl-ops{background:white!important}}`}</style>
  </OpsPage>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex justify-between gap-6 border-b border-[#eee7e1] py-2"><span className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{label}</span><strong className="text-right text-[9px] text-[#514840]">{mono ? <OpsMono>{value}</OpsMono> : value}</strong></div>; }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-5"><span className={strong ? "font-bold" : "text-[#8f857d]"}>{label}</span><span className={strong ? "text-[13px] font-bold" : "font-semibold"}>{value}</span></div>; }
