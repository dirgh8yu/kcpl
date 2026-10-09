"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, FileDown, FileMinus2, Printer, ReceiptText, Trash2 } from "lucide-react";
import { nepalOperationalDate } from "../../../../invoice-effective-status";
import { newPaymentKey } from "../../../payment-key";
import type { StaffRemittance } from "../../../../portal/portal-remittance.server";
import { financePaymentMethodLabels, financePaymentMethods, invoiceStatusLabel, type FinanceInvoice, type FinancePaymentMethod } from "../../finance-data";
import { bsDateLabel } from "../../../../nepali-calendar";
import { OpsBadge, OpsCopyButton, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: FinanceInvoice["status"]): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "issued") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

export function InvoiceWorkspace({ invoice, remittances, companyPan = null }: { invoice: FinanceInvoice; remittances: StaffRemittance[]; companyPan?: string | null }) {
  // An issued invoice prints the number and PAN it was issued with; a draft
  // shows the reference it is worked on under until then.
  const displayNumber = invoice.tax_invoice_number ?? invoice.reference;
  const sellerPan = invoice.seller_pan ?? (invoice.status === "draft" ? companyPan : null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Whether a message is a failure is said where it is raised, not guessed
  // from its wording: "can't be more than what is owed" read as success.
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const done = (text: string) => setNotice({ text, tone: "success" });
  const failed = (error: unknown, fallback: string) => setNotice({ text: error instanceof Error ? error.message : fallback, tone: "danger" });
  const today = nepalOperationalDate();
  const [payment, setPayment] = useState({ amount: invoice.balance_due ? String(invoice.balance_due) : "", paymentDate: today, method: "bank_transfer" as FinancePaymentMethod, reference: "", notes: "", keepExcess: false });
  // Money that arrives after the invoice is paid (paid twice, say) is still recorded, into the customer's credit.
  const [receiveAnyway, setReceiveAnyway] = useState(false);
  const [paymentKey, setPaymentKey] = useState(newPaymentKey);
  const [credit, setCredit] = useState({ amount: "", reason: "" });

  async function invoiceAction(action: "issue" | "void") {
    if (action === "void" && !window.confirm(`Void ${invoice.reference}? This keeps the audit trail but removes the receivable.`)) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Invoice action failed.");
      done(action === "issue" ? "Invoice issued." : "Invoice voided."); router.refresh();
    } catch (error) { failed(error, "Invoice action failed."); }
    finally { setBusy(false); }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}/payments`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": paymentKey }, body: JSON.stringify({ ...payment, amount: Number(payment.amount), keepExcessAsCredit: payment.keepExcess && paymentExcess > 0.005 }) });
      const data = await response.json() as { error?: string; idempotent?: boolean; excessToCredit?: number };
      if (!response.ok) throw new Error(data.error || "Payment could not be recorded.");
      done(data.idempotent ? "This payment was already recorded." : data.excessToCredit ? `Payment recorded. ${money(data.excessToCredit, invoice.currency)} over what was owed is now ${invoice.customer_name}'s credit.` : "Payment recorded."); setPaymentKey(newPaymentKey()); setPayment((current) => ({ ...current, amount: "", reference: "", notes: "", keepExcess: false })); setReceiveAnyway(false); router.refresh();
    } catch (error) { failed(error, "Payment could not be recorded."); }
    finally { setBusy(false); }
  }

  async function acknowledge(remittance: StaffRemittance) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}/remittances/${encodeURIComponent(remittance.id)}`, { method: "PATCH" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The receipt could not be acknowledged.");
      done("Receipt acknowledged. The customer now sees it as acknowledged."); router.refresh();
    } catch (error) { failed(error, "The receipt could not be acknowledged."); }
    finally { setBusy(false); }
  }

  async function issueCreditNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(credit.amount);
    if (!window.confirm(`Credit ${money(amount, invoice.currency)} against ${displayNumber}? A credit note is numbered and can't be withdrawn.`)) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "credit", amount, reason: credit.reason }) });
      const data = await response.json() as { error?: string; creditNote?: string; toCustomerCredit?: number };
      if (!response.ok) throw new Error(data.error || "The credit note could not be issued.");
      done(`${data.creditNote ? `Credit note ${data.creditNote} issued.` : "Credit note issued."}${data.toCustomerCredit ? ` ${money(data.toCustomerCredit, invoice.currency)} already paid is now ${invoice.customer_name}'s credit, to refund or use on another invoice.` : ""}`); setCredit({ amount: "", reason: "" }); router.refresh();
    } catch (error) { failed(error, "The credit note could not be issued."); }
    finally { setBusy(false); }
  }

  // A receipt is the customer's claim; this only pre-fills the form for accounts to check.
  function fillFromReceipt(remittance: StaffRemittance) {
    setPayment((current) => ({
      ...current,
      amount: remittance.amount !== null && (!remittance.currency || remittance.currency === invoice.currency) ? String(Math.min(remittance.amount, invoice.balance_due)) : current.amount,
      paymentDate: remittance.paid_on && /^\d{4}-\d{2}-\d{2}$/.test(remittance.paid_on) ? remittance.paid_on : current.paymentDate,
      notes: `Customer receipt ${remittance.filename}`,
    }));
  }

  const canPay = ["issued", "partially_paid", "overdue"].includes(invoice.status) && invoice.balance_due > 0;
  const showPaymentForm = canPay || (invoice.status === "paid" && receiveAnyway);
  const owedNow = canPay ? invoice.balance_due : 0;
  const paymentExcess = Math.round((Number(payment.amount || 0) - owedNow) * 100) / 100;
  // A credit note can take back the whole invoice. Off what is still owed
  // first; what was already paid becomes the customer's credit, to refund.
  const canCredit = ["issued", "partially_paid", "overdue", "paid"].includes(invoice.status) && invoice.record_type === "invoice" && invoice.total > 0.005;
  const creditToCustomer = Math.round((Number(credit.amount || 0) - invoice.balance_due) * 100) / 100;

  return <OpsPage>
    <div className="no-print"><OpsPageHeader eyebrow="Invoice" title={<span className="inline-flex flex-wrap items-center gap-2"><OpsMono>{displayNumber}</OpsMono><OpsCopyButton value={displayNumber} label={displayNumber}/><OpsBadge tone={statusTone(invoice.status)} dot>{invoiceStatusLabel(invoice)}</OpsBadge></span>} description={invoice.customer_name} actions={<><OpsButton variant="secondary" onClick={() => window.print()}><Printer size={13}/>Print</OpsButton>{invoice.status === "draft" ? <OpsButton variant="primary" disabled={busy} onClick={() => invoiceAction("issue")}>Issue invoice</OpsButton> : null}{invoice.status !== "void" && invoice.amount_paid === 0 && invoice.credit_total === 0 ? <OpsButton variant="danger" disabled={busy} onClick={() => invoiceAction("void")}><Trash2 size={12}/>Void</OpsButton> : null}</>}/></div>

    <div className="ops-content-wide ops-stack">
      {notice ? <div className="no-print"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      <section className="invoice-sheet overflow-hidden rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-[0_14px_40px_rgba(78,59,45,.035)]">
        <div className="border-b border-[var(--admin-line)] p-7 sm:p-10"><div className="flex flex-wrap items-start justify-between gap-8"><div><p className="text-[length:var(--app-label-size)] font-semibold uppercase tracking-[.04em] text-[var(--admin-crimson)]">Kapileshwor Cargo Pvt. Ltd.</p><h2 className="mt-2 text-[36px] font-semibold tracking-[-.055em] text-[var(--admin-ink)]">Invoice</h2><p className="mt-3 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">Pragatipath Finance Complex, 2nd Floor<br/>Mhepi Road, Sorakhutte, Kathmandu, Nepal</p>{sellerPan ? <p className="mt-2 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">PAN/VAT {sellerPan}</p> : <p className="no-print mt-2 text-[length:var(--app-label-size)] text-[var(--admin-warning)]">KCPL&apos;s PAN isn&apos;t set yet, so it won&apos;t print on this invoice.</p>}</div><div className="min-w-[260px] text-[length:var(--app-label-size)]"><Info label="Invoice no." value={invoice.tax_invoice_number ?? (invoice.status === "draft" ? "Given when issued" : invoice.reference)} mono={Boolean(invoice.tax_invoice_number)}/><Info label="Issue date" value={dateLabel(invoice.issue_date)} detail={bsDateLabel(invoice.issue_date)}/><Info label="Due date" value={dateLabel(invoice.due_date)} detail={bsDateLabel(invoice.due_date)}/>{invoice.fiscal_year ? <Info label="Fiscal year" value={invoice.fiscal_year.replace("-", "/")}/> : null}<Info label="Status" value={invoiceStatusLabel(invoice)}/></div></div></div>
        <div className="grid border-b border-[var(--admin-line)] md:grid-cols-2"><div className="p-7 sm:p-10"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Bill to</p><h3 className="mt-2 text-[length:var(--app-text-lg)] font-semibold tracking-[-.025em] text-[var(--admin-ink)]"><Link href={`/admin/crm/${encodeURIComponent(invoice.customer_id)}`} className="ops-cell-link">{invoice.customer_name}</Link></h3>{invoice.customer_tax_id ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">PAN/VAT {invoice.customer_tax_id}</p> : null}</div><div className="border-t border-[var(--admin-line)] p-7 sm:p-10 md:border-l md:border-t-0"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Operational reference</p><p className="mt-2 text-[length:var(--app-label-size)] font-bold text-[var(--admin-ink)]">{invoice.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(invoice.shipment_reference)}`} className="ops-cell-link"><OpsMono>{invoice.shipment_reference}</OpsMono></Link> : "No shipment linked"}</p><p className="mt-2 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Quote {invoice.quote_reference ? <OpsMono>{invoice.quote_reference}</OpsMono> : "not linked"} · {invoice.branch}</p></div></div>
        <div className="p-7 sm:p-10"><div className="ops-scroll-x overflow-x-auto"><table className="ops-table ops-register-table ops-stack-table min-w-[680px]"><thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Tax</th><th className="text-right">Total</th></tr></thead><tbody>{invoice.line_items.map((line) => <tr key={line.id}><td className="font-medium text-[var(--admin-ink)]">{line.description}{line.kind === "disbursement" ? <span className="block text-[length:var(--app-label-size)] font-normal text-[var(--admin-muted)]">Paid on your behalf, at cost</span> : null}</td><td className="text-right">{line.quantity}</td><td className="text-right">{money(line.unit_price, invoice.currency)}</td><td className="text-right">{line.tax_rate}%</td><td className="text-right font-semibold text-[var(--admin-ink)]">{money(line.total, invoice.currency)}</td></tr>)}</tbody></table></div>
          <div className="ml-auto mt-7 max-w-sm space-y-3 text-[length:var(--app-label-size)]"><Total label="Charges" value={money(invoice.subtotal - invoice.disbursement_total, invoice.currency)}/><Total label="Tax" value={money(invoice.tax_total, invoice.currency)}/>{invoice.disbursement_total ? <Total label="Paid on your behalf" value={money(invoice.disbursement_total, invoice.currency)}/> : null}<div className="border-t border-[var(--admin-line)] pt-3"><Total label="Invoice total" value={money(invoice.total + invoice.credit_total, invoice.currency)} strong/></div>{invoice.credit_total ? <Total label="Credit notes" value={`−${money(invoice.credit_total, invoice.currency)}`}/> : null}<Total label="Paid" value={money(invoice.amount_paid + invoice.moved_to_credit_total, invoice.currency)}/>{invoice.moved_to_credit_total ? <Total label="Moved to customer credit" value={`−${money(invoice.moved_to_credit_total, invoice.currency)}`}/> : null}<div className={`rounded-[var(--app-radius)] border px-4 py-3 ${invoice.balance_due > 0 ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]" : "border-[var(--admin-success-line)] bg-[var(--admin-success-bg)] text-[var(--admin-success)]"}`}><Total label="Balance due" value={money(invoice.balance_due, invoice.currency)} strong/></div></div>
          {invoice.credit_notes.length ? <div className="mt-8"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Credit notes</p><div className="ops-scroll-x mt-2 overflow-x-auto"><table className="ops-table ops-register-table ops-stack-table min-w-[560px]"><thead><tr><th>Credit note</th><th>Date</th><th>Reason</th><th className="text-right">Amount</th></tr></thead><tbody>{invoice.credit_notes.map((note) => <tr key={note.id}><td><OpsMono>{note.number}</OpsMono></td><td>{dateLabel(note.credit_date)}<span className="block text-[var(--admin-muted)]">{bsDateLabel(note.credit_date)}</span></td><td>{note.reason}</td><td className="text-right font-semibold text-[var(--admin-ink)]">−{money(note.amount, invoice.currency)}{note.tax_amount ? <span className="block font-normal text-[var(--admin-muted)]">incl. tax {money(note.tax_amount, invoice.currency)}</span> : null}</td></tr>)}</tbody></table></div></div> : null}
          {invoice.notes ? <div className="mt-8 rounded-[var(--app-radius)] bg-[var(--admin-surface-muted)] p-4 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]"><strong className="text-[var(--admin-ink)]">Notes</strong><br/>{invoice.notes}</div> : null}
        </div>
      </section>

      <div className="no-print ops-stack">
        <OpsSurface title="Payments">
          {showPaymentForm ? <form onSubmit={recordPayment} className="grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-2">
            <OpsField label="Amount"><input required min="0.01" step="0.01" type="number" inputMode="decimal" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })}/></OpsField>
            <OpsField label="Payment date"><input required type="date" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })}/></OpsField>
            <OpsField label="Method"><select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value as FinancePaymentMethod })}>{financePaymentMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField>
            <OpsField label="Bank / receipt reference"><input value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })}/></OpsField>
            <OpsField label="Notes" className="sm:col-span-2"><input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })}/></OpsField>
            {/* More than is owed is never banked silently: a mistyped extra zero is refused unless someone says the money really came in. */}
            {paymentExcess > 0.005 ? <label className="flex items-start gap-2 text-[length:var(--app-label-size)] text-[var(--admin-ink)] sm:col-span-2"><input required type="checkbox" className="mt-0.5" checked={payment.keepExcess} onChange={(event) => setPayment({ ...payment, keepExcess: event.target.checked })}/><span>{owedNow > 0 ? `That is ${money(paymentExcess, invoice.currency)} more than is owed.` : "This invoice is already paid."} Keep {money(paymentExcess, invoice.currency)} as {invoice.customer_name}&apos;s credit, to refund or use on another invoice.</span></label> : null}
            <div className="sm:col-span-2"><OpsButton type="submit" variant="primary" disabled={busy}><Banknote size={12}/>{busy ? "Recording…" : "Record payment"}</OpsButton></div>
          </form> : invoice.status === "paid" ? <OpsButton size="sm" variant="ghost" onClick={() => { setReceiveAnyway(true); setPayment((current) => ({ ...current, amount: "" })); }}>Money came in after it was paid?</OpsButton> : null}
          {remittances.length ? <div className="mt-4 rounded-[var(--app-radius)] border border-[var(--admin-line)] p-4">
            <p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Receipts from the customer</p>
            <div className="mt-2 divide-y divide-[var(--admin-line)]">{remittances.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{item.amount !== null ? money(item.amount, item.currency || invoice.currency) : "Amount not stated"}</strong>
                <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{item.paid_on ? `Paid ${dateLabel(item.paid_on)} · ` : ""}Sent {dateLabel(item.uploaded_at.slice(0, 10))} by {item.uploaded_by_email || "the customer"}{item.note ? ` · ${item.note}` : ""}</p>
                {item.acknowledged_at ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Acknowledged {dateLabel(item.acknowledged_at.slice(0, 10))}{item.acknowledged_by_name ? ` by ${item.acknowledged_by_name}` : ""}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/api/admin/finance/invoices/${encodeURIComponent(invoice.reference)}/remittances/${encodeURIComponent(item.id)}`} className="ops-button" data-variant="ghost" data-size="sm"><FileDown size={12}/><span className="max-w-[180px] truncate" title={item.filename}>{item.filename}</span></a>
                {canPay ? <OpsButton size="sm" variant="secondary" disabled={busy} onClick={() => fillFromReceipt(item)}>Fill payment form</OpsButton> : null}
                {item.review_state === "acknowledged"
                  ? <OpsBadge tone="success"><CheckCircle2 size={10}/>Acknowledged</OpsBadge>
                  : <OpsButton size="sm" variant="primary" disabled={busy} onClick={() => acknowledge(item)}>Acknowledge</OpsButton>}
              </div>
            </div>)}</div>
            <p className="mt-2 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">A receipt is the customer&apos;s claim. Record the payment once the money is in the account.</p>
          </div> : null}
          <div className="mt-4 divide-y divide-[var(--admin-line)]">{invoice.payments.length ? invoice.payments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{item.kind === "moved_to_credit" ? `−${money(Math.abs(item.amount), item.currency)}` : money(item.amount, item.currency)}</strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{dateLabel(item.payment_date)} · {item.kind === "payment" ? financePaymentMethodLabels[item.method] : item.kind === "moved_to_credit" ? "Moved to the customer's credit" : "Paid with the customer's credit"}{item.kind === "payment" && item.reference ? ` · ${item.reference}` : ""}{item.kind !== "payment" && item.notes ? ` · ${item.notes}` : ""}</p></div>{item.customer_credit_id && item.kind !== "payment" ? <Link href={`/admin/finance/credits/${encodeURIComponent(item.customer_credit_id)}`} className="ops-button" data-variant="ghost" data-size="sm">Open credit</Link> : <OpsBadge tone="success"><CheckCircle2 size={10}/>Recorded</OpsBadge>}</div>) : <OpsEmptyState icon={<ReceiptText size={17}/>} title="No payments recorded" description="Payments will appear here with method, date and reference."/>}</div>
        </OpsSurface>
        {canCredit ? <OpsSurface title="Credit note" description="Takes an amount off the invoice under its own number, off what is still owed first. Anything already paid becomes the customer's credit, to refund or use on another invoice. Tax and anything paid at cost come off in proportion.">
          <form onSubmit={issueCreditNote} className="grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <OpsField label="Amount, incl. tax"><input required min="0.01" max={invoice.total} step="0.01" type="number" inputMode="decimal" value={credit.amount} onChange={(event) => setCredit({ ...credit, amount: event.target.value })}/></OpsField>
            <OpsField label="Reason"><input required minLength={4} maxLength={300} value={credit.reason} onChange={(event) => setCredit({ ...credit, reason: event.target.value })} placeholder="Agreed discount, charge raised in error…"/></OpsField>
            {creditToCustomer > 0.005 && Number(credit.amount) <= invoice.total + 0.005 ? <p className="text-[length:var(--app-label-size)] text-[var(--admin-ink)] sm:col-span-2">{money(creditToCustomer, invoice.currency)} of this was already paid. It becomes {invoice.customer_name}&apos;s credit, to refund or use on another invoice.</p> : null}
            <div className="sm:col-span-2"><OpsButton type="submit" variant="secondary" disabled={busy}><FileMinus2 size={12}/>{busy ? "Issuing…" : "Issue credit note"}</OpsButton></div>
          </form>
        </OpsSurface> : null}
      </div>
    </div>
    <style jsx global>{`@media print{.no-print{display:none!important}body{background:white!important}.invoice-sheet{box-shadow:none!important;border:0!important;border-radius:0!important}.kcpl-ops{background:white!important}}`}</style>
  </OpsPage>;
}

function Info({ label, value, mono = false, detail }: { label: string; value: string; mono?: boolean; detail?: string }) { return <div className="flex justify-between gap-6 border-b border-[var(--admin-line)] py-2"><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">{label}</span><strong className="text-right text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{mono ? <OpsMono>{value}</OpsMono> : value}{detail ? <span className="block font-normal text-[var(--admin-muted)]">{detail}</span> : null}</strong></div>; }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-5"><span className={strong ? "font-bold" : "text-[var(--admin-muted)]"}>{label}</span><span className={strong ? "text-[length:var(--app-text-base)] font-bold" : "font-semibold"}>{value}</span></div>; }
