"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, CheckCircle2, Trash2 } from "lucide-react";
import { financePaymentMethodLabels, financePaymentMethods, type FinancePaymentMethod } from "../../../finance/finance-data";
import { jobCostCategoryLabels } from "../../../job-file";
import { payableStatusLabels, type PayableBill, type PayableStatus } from "../../payables-data";
import { OpsButton, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsPageHeader, OpsPanel, OpsStatusBadge } from "../../../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function statusTone(status: PayableStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "approved" || status === "partially_paid") return "info";
  if (status === "overdue") return "danger";
  if (status === "draft") return "neutral";
  return "warning";
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

  return <main>
    <OpsPageHeader
      eyebrow="Accounts payable"
      title={bill.reference}
      description={`${bill.supplier_name} · ${bill.branch} · ${roleLabel}`}
      breadcrumbs={[{ label: "Finance" }, { label: "Payables", href: "/admin/payables" }, { label: bill.reference }]}
      meta={<span>Bill {dateLabel(bill.bill_date)} · Due {dateLabel(bill.due_date)} · {jobCostCategoryLabels[bill.category]}</span>}
      actions={<><OpsStatusBadge tone={statusTone(bill.status)}>{payableStatusLabels[bill.status]}</OpsStatusBadge>{bill.status === "draft" ? <OpsButton tone="primary" disabled={busy} onClick={() => void billAction("approve")}>Approve bill</OpsButton> : null}{bill.status !== "void" && bill.amount_paid === 0 ? <OpsButton tone="danger" disabled={busy} onClick={() => void billAction("void")}><Trash2 size={12}/>Void</OpsButton> : null}</>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={4}>
        <OpsMetric label="Bill total" value={<span className="text-[16px]">{money(bill.total, bill.currency)}</span>}/>
        <OpsMetric label="Paid" value={<span className="text-[16px]">{money(bill.amount_paid, bill.currency)}</span>} tone={bill.amount_paid ? "success" : "neutral"}/>
        <OpsMetric label="Balance due" value={<span className="text-[16px]">{money(bill.balance_due, bill.currency)}</span>} tone={bill.balance_due ? "warning" : "success"}/>
        <OpsMetric label="Payments" value={bill.payments.length} icon={<Banknote size={13}/>}/>
      </OpsMetricStrip>

      {notice ? <div className="rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]">{notice}</div> : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <OpsPanel title={bill.supplier_name} eyebrow="Supplier bill" description={bill.supplier_bill_reference ? `Vendor reference ${bill.supplier_bill_reference}` : "No supplier reference supplied"} action={<OpsStatusBadge tone={statusTone(bill.status)}>{payableStatusLabels[bill.status]}</OpsStatusBadge>}>
          <div className="grid gap-x-8 px-4 py-1 sm:grid-cols-2"><Info label="Bill date" value={dateLabel(bill.bill_date)}/><Info label="Due date" value={dateLabel(bill.due_date)}/><Info label="Cost category" value={jobCostCategoryLabels[bill.category]}/><Info label="Branch" value={bill.branch}/><Info label="Supplier CRM" value={bill.supplier_id || "Not linked"}/><Info label="Customer" value={bill.customer_name || "Not linked"}/></div>
          <div className="border-t border-[#eceef0] px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">Description</p><p className="mt-1.5 text-[11px] font-medium text-[#414850]">{bill.description}</p>{bill.notes ? <p className="mt-2 text-[10px] leading-5 text-[#737b84]">{bill.notes}</p> : null}</div>
          <div className="grid gap-px border-t border-[#eceef0] bg-[#eceef0] sm:grid-cols-4"><Summary label="Subtotal" value={money(bill.subtotal, bill.currency)}/><Summary label={`Tax ${bill.tax_rate}%`} value={money(bill.tax_total, bill.currency)}/><Summary label="Paid" value={money(bill.amount_paid, bill.currency)} positive={bill.amount_paid > 0}/><Summary label="Balance due" value={money(bill.balance_due, bill.currency)} positive={bill.balance_due === 0}/></div>
          {bill.shipment_reference ? <div className="border-t border-[#eceef0] p-4"><Link href={`/admin/jobs/${encodeURIComponent(bill.shipment_reference)}`} className="ops-button ops-button-secondary"><BriefcaseBusiness size={13}/>Digital Job File · {bill.shipment_reference}</Link></div> : null}
        </OpsPanel>

        <OpsPanel title="Supplier settlement" eyebrow="Payments" description={`${money(bill.balance_due, bill.currency)} remaining`} action={<OpsStatusBadge tone={bill.balance_due > 0 ? "warning" : "success"}>{bill.balance_due > 0 ? "Open balance" : "Paid"}</OpsStatusBadge>}>
          {bill.status === "draft" ? <div className="border-b border-[#e8e3d8] bg-[#fbf7ef] px-4 py-3 text-[10px] leading-4 text-[#765b31]">Approve this bill first. Approval recognises the cost in the linked Digital Job File.</div> : null}
          {canPay ? <form onSubmit={recordPayment} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-2"><Field label="Amount"><input required min="0.01" max={bill.balance_due} step="0.01" type="number" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></Field><Field label="Payment date"><input required type="date" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></Field><Field label="Method"><select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></Field><Field label="Bank / receipt reference"><input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></Field><div className="sm:col-span-2"><Field label="Notes"><input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></Field></div><div className="sm:col-span-2 flex justify-end"><OpsButton tone="primary" type="submit" disabled={busy}>{busy ? "Recording…" : "Record supplier payment"}</OpsButton></div></form> : null}
          {bill.payments.length ? <div className="divide-y divide-[#eceef0]">{bill.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><strong className="text-xs font-semibold text-[#30363d]">{money(item.amount, item.currency)}</strong><p className="mt-1 text-[9px] text-[#8d949b]">{dateLabel(item.payment_date)} · {financePaymentMethodLabels[item.method]}{item.reference ? ` · ${item.reference}` : ""}</p></div><span className="flex items-center gap-1 text-[9px] font-medium text-[#47765b]"><CheckCircle2 size={11}/>Recorded</span></div>)}</div> : <OpsEmptyState compact title="No supplier payments recorded" detail={canPay ? "Record the first settlement above." : "No payment entry is required for this bill state."}/>} 
        </OpsPanel>
      </div>
    </div>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-[#eceef0] py-3 text-[11px]"><span className="text-[#858c94]">{label}</span><strong className="text-right font-medium text-[#414850]">{value}</strong></div>; }
function Summary({ label, value, positive }: { label: string; value: string; positive?: boolean }) { return <div className="bg-white p-3.5"><p className="text-[9px] text-[#91989f]">{label}</p><p className={`mt-1 text-xs font-semibold ${positive === true ? "text-[#397052]" : positive === false ? "text-[#9a4d55]" : "text-[#414850]"}`}>{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>; }
