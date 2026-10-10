"use client";
import { nepalOperationalDate } from "../../../../invoice-effective-status";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, CheckCircle2, ReceiptText, Trash2 } from "lucide-react";
import { financePaymentMethodLabels, financePaymentMethods, type FinancePaymentMethod } from "../../../finance/finance-data";
import { jobCostCategoryLabels } from "../../../job-file";
import { payableStatusLabels, type PayableBill } from "../../payables-data";
import { OpsBadge, OpsCopyButton, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../../operations-ui";
import { newPaymentKey } from "../../../payment-key";

function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString("en-AU")}`; } }
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: PayableBill["status"]): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "approved") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

export function PayableWorkspace({ bill }: { bill: PayableBill }) {
  const router = useRouter();
  const today = nepalOperationalDate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState({ amount: bill.balance_due ? String(bill.balance_due) : "", paymentDate: today, method: "bank_transfer" as FinancePaymentMethod, reference: "", notes: "", tds: "" });
  const [paymentKey, setPaymentKey] = useState(newPaymentKey);
  const openingBalance = bill.record_type === "opening_balance";

  async function billAction(action: "approve" | "void") {
    if (action === "void") {
      const message = openingBalance
        ? `Void ${bill.reference}? This keeps the migration audit trail but removes the opening payable from Accounts Payable.`
        : `Void ${bill.reference}? This keeps the audit trail and removes its linked Job File cost.`;
      if (!window.confirm(message)) return;
    }
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/payables/bills/${encodeURIComponent(bill.reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Supplier payable action failed.");
      setNotice(action === "approve" ? "Supplier bill approved and Job File cost recognised." : openingBalance ? "Opening payable voided." : "Supplier bill voided."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier payable action failed."); }
    finally { setBusy(false); }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/payables/bills/${encodeURIComponent(bill.reference)}/payments`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": paymentKey }, body: JSON.stringify({ ...payment, amount: Number(payment.amount || 0), tdsAmount: Number(payment.tds || 0) }) });
      const data = await response.json() as { error?: string; idempotent?: boolean };
      if (!response.ok) throw new Error(data.error || "Supplier payment could not be recorded.");
      setNotice(data.idempotent ? "This supplier payment was already recorded." : Number(payment.tds) > 0 ? `Supplier payment recorded, with ${money(Number(payment.tds), bill.currency)} TDS withheld. Deposit it by the 25th of next month (Tax & books).` : "Supplier payment recorded."); setPaymentKey(newPaymentKey()); setPayment((current) => ({ ...current, amount: "", reference: "", notes: "", tds: "" })); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier payment could not be recorded."); }
    finally { setBusy(false); }
  }

  const canPay = ["approved", "partially_paid", "overdue"].includes(bill.status) && bill.balance_due > 0;
  // Paid plus TDS must settle no more than is owed; the server refuses more.
  const settling = Number(payment.amount || 0) + Number(payment.tds || 0);
  const tdsHint = settling - bill.balance_due > 0.005 ? `Paid and TDS together are more than the ${money(bill.balance_due, bill.currency)} owed.` : "If any. KCPL deposits it with the tax office.";
  const asOfDate = bill.migration_as_of_date || bill.bill_date;

  return <OpsPage>
    <OpsPageHeader eyebrow={openingBalance ? "Supplier bill · Opening balance" : "Supplier bill"} title={<span className="inline-flex flex-wrap items-center gap-2"><OpsMono>{bill.reference}</OpsMono><OpsCopyButton value={bill.reference} label={bill.reference}/><OpsBadge tone={statusTone(bill.status)} dot>{payableStatusLabels[bill.status]}</OpsBadge></span>} description={bill.supplier_name} meta={<><span>{openingBalance ? `As at ${dateLabel(asOfDate)}` : `Bill ${dateLabel(bill.bill_date)}`}</span><span>Due {dateLabel(bill.due_date)}</span></>} actions={<>{bill.status === "draft" && !openingBalance ? <OpsButton variant="primary" disabled={busy} onClick={() => billAction("approve")}>Approve bill</OpsButton> : null}{bill.status !== "void" && bill.amount_paid === 0 ? <OpsButton variant="danger" disabled={busy} onClick={() => billAction("void")}><Trash2 size={12}/>Void</OpsButton> : null}</>}/>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.toLowerCase().includes("failed") || notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {bill.source === "partner_portal" ? <OpsNotice tone={bill.partner_reading_check && !bill.partner_reading_check.matches ? "warning" : "neutral"}>
        <strong>Sent by {bill.supplier_name} through the partner portal.</strong>{" "}
        {bill.partner_document_id !== null && bill.shipment_reference ? <a className="ops-cell-link" href={`/api/admin/shipments/${encodeURIComponent(bill.shipment_reference)}/documents/${bill.partner_document_id}`}>Open their invoice</a> : "Their file didn’t save; ask them to send it again."}
        {bill.partner_reading_check ? (bill.partner_reading_check.matches ? " KCPL’s reader found the same number and total on the invoice." : ` Check before approving: ${bill.partner_reading_check.issues.join("; ")}.`) : null}
      </OpsNotice> : null}
      {openingBalance ? <OpsNotice tone="neutral"><strong>Migration opening payable.</strong> This is the supplier balance KCPL owed as at {dateLabel(asOfDate)}. It affects outstanding payables and aging, but it is not treated as a historical supplier bill or Job File cost.{bill.migration_batch_id ? <> Migration batch <OpsMono>{bill.migration_batch_id}</OpsMono>.</> : null}</OpsNotice> : null}
      <div className="ops-grid-main">
        <div className="ops-stack">
          {/* Supplier, status and dates are the header's; this is what they do not say. */}
          <OpsSurface title="Bill details" description={!openingBalance && bill.supplier_bill_reference ? `Vendor reference ${bill.supplier_bill_reference}` : undefined}>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Fact label={openingBalance ? "Accounting treatment" : "Category"} value={openingBalance ? "Ledger opening only" : jobCostCategoryLabels[bill.category]}/><Fact label="Branch" value={bill.branch}/><Fact label="Currency" value={bill.currency}/></div>
            <div className="mt-6 grid gap-2 sm:grid-cols-4">{openingBalance ? <Metric label="Opening balance" value={money(bill.total,bill.currency)}/> : <><Metric label="Subtotal" value={money(bill.subtotal,bill.currency)}/><Metric label={`Tax ${bill.tax_rate}%`} value={money(bill.tax_total,bill.currency)}/></>}<Metric label="Paid" value={money(bill.amount_paid,bill.currency)} tone="success"/><Metric label="Balance due" value={money(bill.balance_due,bill.currency)} tone={bill.balance_due > 0 ? "warning" : "success"}/></div>
            <div className="mt-5 rounded-[var(--app-radius)] bg-[var(--admin-surface-muted)] p-4"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Description</p><p className="mt-2 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">{bill.description}</p>{bill.notes ? <p className="mt-2 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{bill.notes}</p> : null}</div>
            {!openingBalance && bill.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(bill.shipment_reference)}`} className="mt-4 inline-flex items-center gap-2 text-[length:var(--app-label-size)] font-bold text-[var(--admin-crimson)]"><BriefcaseBusiness size={12}/>Open shipment record · <OpsMono>{bill.shipment_reference}</OpsMono></Link> : null}
            {!openingBalance && bill.shipment_reference && bill.replaces_job_cost_id ? <p className="mt-2 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{bill.status === "draft" ? "Once approved, this bill replaces a hand-typed cost on the Job File, so the job counts it once." : "This bill replaced a hand-typed cost on the Job File, so the job counts it once."}</p> : null}
          </OpsSurface>
        </div>

        <OpsSurface title="Supplier payments" description={`${money(bill.balance_due,bill.currency)} currently due.`}>
          {bill.status === "draft" && !openingBalance ? <OpsNotice tone="warning">Approve this bill first. Approval recognises the cost in the linked shipment record.</OpsNotice> : null}
          {canPay ? <form onSubmit={recordPayment} className="mt-4 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-2"><OpsField label="Amount paid"><input required={!Number(payment.tds)} min="0" max={bill.balance_due} step="0.01" type="number" inputMode="decimal" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></OpsField><OpsField label="TDS withheld" hint={tdsHint}><input min="0" max={bill.balance_due} step="0.01" type="number" inputMode="decimal" value={payment.tds} onChange={(event) => setPayment({ ...payment, tds: event.target.value })}/></OpsField><OpsField label="Payment date"><input required type="date" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></OpsField><OpsField label="Method"><select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField><OpsField label="Bank / receipt reference"><input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></OpsField><OpsField label="Notes" className="sm:col-span-2"><input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></OpsField><div className="sm:col-span-2"><OpsButton type="submit" variant="primary" disabled={busy}><Banknote size={12}/>{busy ? "Recording…" : "Record supplier payment"}</OpsButton></div></form> : null}
          <div className="mt-4 divide-y divide-[var(--admin-line)]">{bill.payments.length ? bill.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{money(item.amount,item.currency)}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{dateLabel(item.payment_date)} · {item.kind === "tds_withheld" ? "TDS withheld for the tax office" : financePaymentMethodLabels[item.method]}{item.kind === "payment" && item.reference ? ` · ${item.reference}` : ""}</p></div><OpsBadge tone="success"><CheckCircle2 size={10}/>Recorded</OpsBadge></div>) : <OpsEmptyState icon={<ReceiptText size={17}/>} title="No supplier payments" description="Payment history will appear here after settlement is recorded."/>}</div>
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}

function Fact({label,value}:{label:string;value:string}) { return <div><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">{label}</p><p className="mt-1.5 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">{value}</p></div>; }
function Metric({label,value,tone="neutral"}:{label:string;value:string;tone?:"neutral"|"success"|"warning"}) { return <div className="rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">{label}</p><strong className={`mt-1.5 block text-[length:var(--app-label-size)] ${tone === "success" ? "text-[var(--admin-success)]" : tone === "warning" ? "text-[var(--admin-warning)]" : "text-[var(--admin-ink)]"}`}>{value}</strong></div>; }
