"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, Building2, CheckCircle2, Printer, Trash2 } from "lucide-react";
import { financeInvoiceStatusLabels, financePaymentMethodLabels, financePaymentMethods, type FinanceInvoice, type FinanceInvoiceStatus, type FinancePaymentMethod } from "../../finance-data";
import { OpsButton, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsPageHeader, OpsPanel, OpsStatusBadge } from "../../../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}
function statusTone(status: FinanceInvoiceStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "issued" || status === "partially_paid") return "info";
  if (status === "overdue") return "danger";
  if (status === "draft") return "neutral";
  return "warning";
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

  return <main>
    <div className="no-print">
      <OpsPageHeader
        eyebrow="Accounts receivable"
        title={invoice.reference}
        description={`${invoice.customer_name} · ${invoice.branch} · ${roleLabel}`}
        breadcrumbs={[{ label: "Finance", href: "/admin/finance" }, { label: "Invoices", href: "/admin/finance" }, { label: invoice.reference }]}
        meta={<span>Issued {dateLabel(invoice.issue_date)} · Due {dateLabel(invoice.due_date)}</span>}
        actions={<><OpsStatusBadge tone={statusTone(invoice.status)}>{financeInvoiceStatusLabels[invoice.status]}</OpsStatusBadge><OpsButton onClick={() => window.print()}><Printer size={12}/>Print</OpsButton>{invoice.status === "draft" ? <OpsButton tone="primary" disabled={busy} onClick={() => void invoiceAction("issue")}>Issue invoice</OpsButton> : null}{invoice.status !== "void" && invoice.amount_paid === 0 ? <OpsButton tone="danger" disabled={busy} onClick={() => void invoiceAction("void")}><Trash2 size={12}/>Void</OpsButton> : null}</>}
      />
    </div>

    <div className="ops-page-body ops-stack">
      <div className="no-print">
        <OpsMetricStrip columns={4}>
          <OpsMetric label="Invoice total" value={<span className="text-[16px]">{money(invoice.total, invoice.currency)}</span>}/>
          <OpsMetric label="Paid" value={<span className="text-[16px]">{money(invoice.amount_paid, invoice.currency)}</span>} tone={invoice.amount_paid ? "success" : "neutral"}/>
          <OpsMetric label="Balance due" value={<span className="text-[16px]">{money(invoice.balance_due, invoice.currency)}</span>} tone={invoice.balance_due ? "warning" : "success"}/>
          <OpsMetric label="Payments" value={invoice.payments.length} icon={<Banknote size={13}/>}/>
        </OpsMetricStrip>
        {notice ? <div className="mt-3 rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]">{notice}</div> : null}
      </div>

      <section className="invoice-sheet overflow-hidden rounded-xl border border-[#dfe2e6] bg-white">
        <div className="border-b border-[#e5e7e9] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-8"><div><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#6772a8]">Kapileshwor Cargo Pvt. Ltd.</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#20252a]">INVOICE</h2><p className="mt-3 text-[11px] leading-5 text-[#737b84]">Pragatipath Finance Complex, 2nd Floor<br/>Mhepi Road, Sorakhutte, Kathmandu, Nepal</p></div><div className="min-w-[250px] text-[11px]"><InvoiceInfo label="Invoice" value={invoice.reference}/><InvoiceInfo label="Issue date" value={dateLabel(invoice.issue_date)}/><InvoiceInfo label="Due date" value={dateLabel(invoice.due_date)}/><InvoiceInfo label="Status" value={financeInvoiceStatusLabels[invoice.status]}/></div></div></div>
        <div className="grid border-b border-[#e5e7e9] md:grid-cols-2"><div className="p-6 sm:p-8"><p className="text-[9px] font-semibold uppercase tracking-[.07em] text-[#91989f]">Bill to</p><h3 className="mt-2 text-lg font-semibold text-[#30363d]">{invoice.customer_name}</h3><p className="mt-2 text-[10px] text-[#858c94]">Customer reference: {invoice.customer_id}</p></div><div className="border-t border-[#e5e7e9] p-6 sm:p-8 md:border-l md:border-t-0"><p className="text-[9px] font-semibold uppercase tracking-[.07em] text-[#91989f]">Operational reference</p><p className="mt-2 text-xs font-semibold text-[#30363d]">{invoice.shipment_reference || "No shipment linked"}</p><p className="mt-2 text-[10px] text-[#858c94]">Quote: {invoice.quote_reference || "Not linked"} · Branch: {invoice.branch}</p></div></div>
        <div className="p-6 sm:p-8"><div className="overflow-x-auto"><table className="min-w-[680px]"><thead><tr><th className="text-left">Description</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Tax</th><th className="text-right">Total</th></tr></thead><tbody>{invoice.line_items.map((line) => <tr key={line.id}><td className="py-4 pr-4 font-medium">{line.description}</td><td className="py-4 text-right">{line.quantity}</td><td className="py-4 text-right">{money(line.unit_price, invoice.currency)}</td><td className="py-4 text-right">{line.tax_rate}%</td><td className="py-4 text-right font-semibold">{money(line.total, invoice.currency)}</td></tr>)}</tbody></table></div>
          <div className="ml-auto mt-6 max-w-sm divide-y divide-[#e8eaec] text-[11px]"><Total label="Subtotal" value={money(invoice.subtotal, invoice.currency)}/><Total label="Tax" value={money(invoice.tax_total, invoice.currency)}/><Total label="Invoice total" value={money(invoice.total, invoice.currency)} strong/><Total label="Paid" value={money(invoice.amount_paid, invoice.currency)}/><div className={`mt-2 rounded-lg px-3 ${invoice.balance_due > 0 ? "bg-[#f4f3ed]" : "bg-[#eef6f0]"}`}><Total label="Balance due" value={money(invoice.balance_due, invoice.currency)} strong/></div></div>
          {invoice.notes ? <div className="mt-6 rounded-lg bg-[#fafafa] p-3 text-[11px] leading-5 text-[#626a73]"><strong className="font-semibold text-[#30363d]">Notes</strong><br/>{invoice.notes}</div> : null}
        </div>
      </section>

      <div className="no-print grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
        <OpsPanel title="Connected records" eyebrow="Links"><div className="space-y-2 p-4"><Link href={`/admin/crm/${encodeURIComponent(invoice.customer_id)}`} className="ops-button ops-button-secondary w-full justify-start"><Building2 size={13}/>Customer 360</Link>{invoice.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(invoice.shipment_reference)}`} className="ops-button ops-button-secondary w-full justify-start"><BriefcaseBusiness size={13}/>Digital Job File</Link> : null}</div></OpsPanel>
        <OpsPanel title="Payments" eyebrow="Collections" description={`${money(invoice.balance_due, invoice.currency)} remaining`} action={<OpsStatusBadge tone={invoice.balance_due > 0 ? "warning" : "success"}>{invoice.balance_due > 0 ? "Open balance" : "Paid"}</OpsStatusBadge>}>
          {canPay ? <form onSubmit={recordPayment} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Amount"><input required min="0.01" max={invoice.balance_due} step="0.01" type="number" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></Field><Field label="Payment date"><input required type="date" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></Field><Field label="Method"><select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></Field><Field label="Bank / receipt reference"><input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></Field><div className="sm:col-span-2 xl:col-span-4"><Field label="Notes"><input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></Field></div><div className="sm:col-span-2 xl:col-span-4 flex justify-end"><OpsButton tone="primary" type="submit" disabled={busy}>{busy ? "Recording…" : "Record payment"}</OpsButton></div></form> : null}
          {invoice.payments.length ? <div className="divide-y divide-[#eceef0]">{invoice.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><strong className="text-xs font-semibold text-[#30363d]">{money(item.amount, item.currency)}</strong><p className="mt-1 text-[9px] text-[#8d949b]">{dateLabel(item.payment_date)} · {financePaymentMethodLabels[item.method]}{item.reference ? ` · ${item.reference}` : ""}</p></div><span className="flex items-center gap-1 text-[9px] font-medium text-[#47765b]"><CheckCircle2 size={11}/>Recorded</span></div>)}</div> : <OpsEmptyState compact title="No payments recorded" detail={canPay ? "Record the first collection above." : "No payment entry is required for this invoice state."}/>} 
        </OpsPanel>
      </div>
    </div>
    <style jsx global>{`@media print{.no-print{display:none!important}body{background:white!important}.invoice-sheet{box-shadow:none!important;border:0!important;border-radius:0!important}.ops-page-body{padding:0!important;max-width:none!important}}`}</style>
  </main>;
}

function InvoiceInfo({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-6 border-b border-[#eceef0] py-2"><span className="text-[#8d949b]">{label}</span><strong className="text-right font-medium text-[#414850]">{value}</strong></div>; }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-5 py-2.5"><span className={strong ? "font-semibold text-[#30363d]" : "text-[#7b838c]"}>{label}</span><span className={strong ? "text-sm font-semibold text-[#30363d]" : "font-medium text-[#4b535b]"}>{value}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>; }
