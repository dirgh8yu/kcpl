"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, CheckCircle2, ReceiptText, Trash2 } from "lucide-react";
import { financePaymentMethodLabels, financePaymentMethods, type FinancePaymentMethod } from "../../../finance/finance-data";
import { jobCostCategoryLabels } from "../../../job-file";
import { payableStatusLabels, type PayableBill } from "../../payables-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../../operations-ui";

function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString("en-AU")}`; } }
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: PayableBill["status"]): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "approved") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

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
      setNotice(action === "approve" ? "Supplier bill approved and Job File cost recognised." : "Supplier bill voided."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier bill action failed."); }
    finally { setBusy(false); }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/payables/bills/${encodeURIComponent(bill.reference)}/payments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payment, amount: Number(payment.amount) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Supplier payment could not be recorded.");
      setNotice("Supplier payment recorded."); setPayment((current) => ({ ...current, amount: "", reference: "", notes: "" })); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier payment could not be recorded."); }
    finally { setBusy(false); }
  }

  const canPay = ["approved", "partially_paid", "overdue"].includes(bill.status) && bill.balance_due > 0;

  return <OpsPage>
    <OpsPageHeader eyebrow="Accounts Payable" title={<OpsMono>{bill.reference}</OpsMono>} description={`${bill.supplier_name} · ${roleLabel}`} meta={<><OpsBadge tone={statusTone(bill.status)} dot>{payableStatusLabels[bill.status]}</OpsBadge><span>Bill {dateLabel(bill.bill_date)}</span><span>Due {dateLabel(bill.due_date)}</span></>} actions={<><Link href="/admin/payables" className="ops-button" data-variant="secondary" data-size="md">Back to AP</Link>{bill.status === "draft" ? <OpsButton variant="primary" disabled={busy} onClick={() => billAction("approve")}>Approve bill</OpsButton> : null}{bill.status !== "void" && bill.amount_paid === 0 ? <OpsButton variant="danger" disabled={busy} onClick={() => billAction("void")}><Trash2 size={12}/>Void</OpsButton> : null}</>}/>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.toLowerCase().includes("failed") || notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      <div className="ops-grid-main">
        <div className="ops-stack">
          <OpsSurface eyebrow="Supplier bill" title={bill.supplier_name} description={bill.supplier_bill_reference ? `Vendor reference ${bill.supplier_bill_reference}` : "No vendor bill reference supplied."}>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Fact label="Status" value={payableStatusLabels[bill.status]}/><Fact label="Bill date" value={dateLabel(bill.bill_date)}/><Fact label="Due date" value={dateLabel(bill.due_date)}/><Fact label="Category" value={jobCostCategoryLabels[bill.category]}/><Fact label="Branch" value={bill.branch}/><Fact label="Currency" value={bill.currency}/></div>
            <div className="mt-6 grid gap-2 sm:grid-cols-4"><Metric label="Subtotal" value={money(bill.subtotal,bill.currency)}/><Metric label={`Tax ${bill.tax_rate}%`} value={money(bill.tax_total,bill.currency)}/><Metric label="Paid" value={money(bill.amount_paid,bill.currency)} tone="success"/><Metric label="Balance due" value={money(bill.balance_due,bill.currency)} tone={bill.balance_due > 0 ? "warning" : "success"}/></div>
            <div className="mt-5 rounded-[13px] bg-[#faf7f4] p-4"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Description</p><p className="mt-2 text-[10px] font-semibold text-[#514840]">{bill.description}</p>{bill.notes ? <p className="mt-2 text-[9px] leading-5 text-[#81776f]">{bill.notes}</p> : null}</div>
            {bill.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(bill.shipment_reference)}`} className="mt-4 inline-flex items-center gap-2 text-[9px] font-bold text-[#b5654f]"><BriefcaseBusiness size={12}/>Open Digital Job File · <OpsMono>{bill.shipment_reference}</OpsMono></Link> : null}
          </OpsSurface>
        </div>

        <OpsSurface eyebrow="Settlement" title="Supplier payments" description={`${money(bill.balance_due,bill.currency)} currently due.`}>
          {bill.status === "draft" ? <OpsNotice tone="warning">Approve this bill first. Approval recognises the cost in the linked Digital Job File.</OpsNotice> : null}
          {canPay ? <form onSubmit={recordPayment} className="mt-4 grid gap-3 rounded-[13px] border border-[#eae2dc] bg-[#faf7f4] p-4 sm:grid-cols-2"><OpsField label="Amount"><input required min="0.01" max={bill.balance_due} step="0.01" type="number" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></OpsField><OpsField label="Payment date"><input required type="date" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></OpsField><OpsField label="Method"><select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField><OpsField label="Bank / receipt reference"><input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></OpsField><OpsField label="Notes" className="sm:col-span-2"><input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></OpsField><div className="sm:col-span-2"><OpsButton variant="primary" disabled={busy}><Banknote size={12}/>{busy ? "Recording…" : "Record supplier payment"}</OpsButton></div></form> : null}
          <div className="mt-4 divide-y divide-[#eee7e1]">{bill.payments.length ? bill.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-[10px] text-[#514840]">{money(item.amount,item.currency)}</strong><p className="mt-1 text-[8px] text-[#948a82]">{dateLabel(item.payment_date)} · {financePaymentMethodLabels[item.method]}{item.reference ? ` · ${item.reference}` : ""}</p></div><OpsBadge tone="success"><CheckCircle2 size={10}/>Recorded</OpsBadge></div>) : <OpsEmptyState icon={<ReceiptText size={17}/>} title="No supplier payments" description="Payment history will appear here after settlement is recorded."/>}</div>
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}

function Fact({label,value}:{label:string;value:string}) { return <div><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{label}</p><p className="mt-1.5 text-[10px] font-semibold text-[#5b524b]">{value}</p></div>; }
function Metric({label,value,tone="neutral"}:{label:string;value:string;tone?:"neutral"|"success"|"warning"}) { return <div className="rounded-[12px] border border-[#eae2dc] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9c928a]">{label}</p><strong className={`mt-1.5 block text-[11px] ${tone === "success" ? "text-[#66806b]" : tone === "warning" ? "text-[#9a682f]" : "text-[#514840]"}`}>{value}</strong></div>; }
