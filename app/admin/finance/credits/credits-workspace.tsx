"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, HandCoins } from "lucide-react";
import { nepalOperationalDate } from "../../../invoice-effective-status";
import { crmCurrencies } from "../../crm/crm-data";
import { newPaymentKey } from "../../payment-key";
import { financePaymentMethodLabels } from "../finance-data";
import type { FinanceCustomerCredit, FinanceRefund } from "../finance-data";
import { customerCreditSourceLabels, refundMethods, refundStatusLabels } from "../refund-policy";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMetric, OpsMetricStrip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { dateLabel, money, refundTone, totalsByCurrency } from "./credits-format";

export function CreditsWorkspace({ credits, refunds, isManagement }: { credits: FinanceCustomerCredit[]; refunds: FinanceRefund[]; isManagement: boolean }) {
  const waiting = refunds.filter((refund) => refund.status === "requested");
  const toPay = refunds.filter((refund) => refund.status === "approved");
  const settled = refunds.filter((refund) => refund.status !== "requested" && refund.status !== "approved");
  const held = credits.map((credit) => ({ currency: credit.currency, amount: credit.available + credit.reserved }));

  return <OpsPage>
    <OpsPageHeader eyebrow="Finance" title="Credits & refunds" description="Money customers paid that KCPL no longer earns: from a credit note on a paid invoice, or a payment above what was owed. Each is paid back, after Management approves, or used on another of the customer's invoices."/>
    <div className="ops-content-wide ops-stack">
      <OpsMetricStrip columns={3}>
        <OpsMetric label="Held for customers" value={held.length ? totalsByCurrency(held) : "Nothing"} detail={`${credits.length} credit${credits.length === 1 ? "" : "s"}`}/>
        <OpsMetric label="Waiting for approval" value={String(waiting.length)} detail={waiting.length ? (isManagement ? "Yours to approve or reject" : "With Management") : "None"}/>
        <OpsMetric label="Approved, to pay" value={String(toPay.length)} detail={toPay.length ? totalsByCurrency(toPay) : "None"}/>
      </OpsMetricStrip>

      {waiting.length || toPay.length ? <OpsSurface title="Refunds to act on" flush>
        <RefundTable refunds={[...waiting, ...toPay]}/>
      </OpsSurface> : null}

      <OpsSurface title="Credits held" flush>
        {credits.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
          <thead><tr><th>Customer</th><th>From</th><th>Free to use</th><th>Held for refunds</th><th>Since</th></tr></thead>
          <tbody>{credits.map((credit) => <tr key={credit.id}>
            <td data-cell="primary"><Link href={`/admin/finance/credits/${encodeURIComponent(credit.id)}`} className="ops-cell-primary">{credit.customer_name}</Link><span className="ops-cell-secondary">{credit.branch}</span></td>
            <td data-cell="meta" data-label="From"><OpsMono>{credit.source === "advance" ? credit.receipt_number ?? credit.source_invoice_number : credit.source_invoice_number}</OpsMono><span className="ops-cell-secondary">{customerCreditSourceLabels[credit.source]}{credit.source === "advance" && credit.linked_invoice_reference ? `, for ${credit.linked_invoice_reference}` : ""}</span></td>
            <td data-cell="amount" data-label="Free to use" className="font-semibold tabular-nums text-[var(--admin-ink)]">{money(credit.available, credit.currency)}</td>
            <td data-cell="meta" data-label="Held for refunds" className="tabular-nums">{credit.reserved ? money(credit.reserved, credit.currency) : "—"}</td>
            <td data-cell="meta" data-label="Since">{dateLabel(credit.created_at)}</td>
          </tr>)}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact kind="healthy" icon={<HandCoins size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No credit held for anyone" description="A credit appears here when a paid invoice is credited, or a customer pays more than they owe."/>}
      </OpsSurface>

      {settled.length ? <OpsSurface title="Recent refunds" flush><RefundTable refunds={settled}/></OpsSurface> : null}

      <AdvanceForm/>
    </div>
  </OpsPage>;
}

function RefundTable({ refunds }: { refunds: FinanceRefund[] }) {
  return <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
    <thead><tr><th>Customer</th><th>Amount</th><th>Asked for</th><th>Status</th></tr></thead>
    <tbody>{refunds.map((refund) => <tr key={refund.id}>
      <td data-cell="primary"><Link href={`/admin/finance/credits/${encodeURIComponent(refund.credit_id)}`} className="ops-cell-primary">{refund.customer_name}</Link><span className="ops-cell-secondary">{refund.number ? <OpsMono>{refund.number}</OpsMono> : refund.reason}</span></td>
      <td data-cell="amount" data-label="Amount" className="font-semibold tabular-nums text-[var(--admin-ink)]">{money(refund.amount, refund.currency)}</td>
      <td data-cell="meta" data-label="Asked for">{dateLabel(refund.requested_at)}<span className="ops-cell-secondary">by {refund.requested_by_name}</span></td>
      <td data-cell="status"><OpsBadge tone={refundTone(refund.status)} dot>{refund.status === "paid" && refund.paid_on ? `Paid ${dateLabel(refund.paid_on)}` : refundStatusLabels[refund.status]}</OpsBadge></td>
    </tr>)}</tbody>
  </table></OpsTableWrap>;
}

/** An advance not tied to a proforma: held as the customer's credit for their next invoices. */
function AdvanceForm() {
  const router = useRouter();
  const [form, setForm] = useState({ customerId: "", currency: "NPR", amount: "", receivedOn: nepalOperationalDate(), method: "bank_transfer", reference: "", notes: "" });
  const [key, setKey] = useState(newPaymentKey);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/finance/advances", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ ...form, customerId: form.customerId.trim().toUpperCase(), amount: Number(form.amount) }) });
      const data = await response.json() as { error?: string; receipt?: string; credit?: string };
      if (!response.ok) throw new Error(data.error || "The advance could not be recorded.");
      setNotice({ text: `Advance recorded, receipt ${data.receipt ?? ""}. It is the customer's credit until it is used or refunded.`, tone: "success" });
      setKey(newPaymentKey()); setForm((current) => ({ ...current, customerId: "", amount: "", reference: "", notes: "" })); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The advance could not be recorded.", tone: "danger" }); }
    finally { setBusy(false); }
  }
  return <OpsSurface title="Record an advance" description="Money a customer pays before they are invoiced. For a specific shipment, record it on its draft invoice instead, so it is used there when issued.">
    {notice ? <div className="mb-3"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <OpsField label="Customer reference" hint="KCPL-C-…"><input required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}/></OpsField>
      <OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
      <OpsField label="Amount"><input required min="0.01" step="0.01" type="number" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField>
      <OpsField label="Received on"><input required type="date" max={nepalOperationalDate()} value={form.receivedOn} onChange={(event) => setForm({ ...form, receivedOn: event.target.value })}/></OpsField>
      <OpsField label="Method"><select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{refundMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField>
      <OpsField label="Bank / receipt reference"><input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })}/></OpsField>
      <OpsField label="Notes" className="sm:col-span-3"><input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></OpsField>
      <div className="sm:col-span-3"><OpsButton type="submit" variant="secondary" disabled={busy}><Banknote size={12}/>Record advance</OpsButton></div>
    </form>
  </OpsSurface>;
}
