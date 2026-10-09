"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, HandCoins, ReceiptText, Undo2, XCircle } from "lucide-react";
import { nepalOperationalDate } from "../../../../invoice-effective-status";
import { financePaymentMethodLabels, type FinanceCreditEvent, type FinanceCustomerCredit, type FinanceRefund } from "../../finance-data";
import { customerCreditSourceLabels, refundMethods, refundStatusLabels, refundTransition, type RefundAction } from "../../refund-policy";
import { OpsBadge, OpsButton, OpsDetailGrid, OpsDetailItem, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface, OpsTimeline } from "../../../operations-ui";
import { dateLabel, money, refundTone } from "../credits-format";

type OpenInvoice = { reference: string; number: string; balance_due: number; due_date: string };
type Viewer = { role: string; email: string };

export function CreditWorkspace({ credit, refunds, history, openInvoices, viewer }: {
  credit: FinanceCustomerCredit;
  refunds: FinanceRefund[];
  history: FinanceCreditEvent[];
  openInvoices: OpenInvoice[];
  viewer: Viewer;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const [refundForm, setRefundForm] = useState({ amount: credit.available ? String(credit.available) : "", reason: "", payeeDetails: "" });
  const firstInvoice = openInvoices[0];
  const [applyForm, setApplyForm] = useState({ invoiceReference: firstInvoice?.reference ?? "", amount: firstInvoice ? String(Math.min(credit.available, firstInvoice.balance_due)) : "" });

  async function send(url: string, method: "POST" | "PATCH", body: Record<string, unknown>, success: (data: Record<string, unknown>) => string) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "That didn't go through.");
      setNotice({ text: success(data), tone: "success" });
      router.refresh();
      return true;
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "That didn't go through.", tone: "danger" });
      return false;
    } finally { setBusy(false); }
  }

  async function askForRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await send(`/api/admin/finance/credits/${encodeURIComponent(credit.id)}/refunds`, "POST", { ...refundForm, amount: Number(refundForm.amount) },
      (data) => data.status === "approved" ? "Refund approved. Record it as paid once the money has gone." : "Refund asked for. Management approves it before it is paid.");
    if (ok) setRefundForm({ amount: "", reason: "", payeeDetails: "" });
  }

  async function useOnInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invoice = openInvoices.find((item) => item.reference === applyForm.invoiceReference);
    if (!window.confirm(`Use ${money(Number(applyForm.amount), credit.currency)} of this credit on ${invoice?.number ?? applyForm.invoiceReference}?`)) return;
    await send(`/api/admin/finance/credits/${encodeURIComponent(credit.id)}/apply`, "POST", { ...applyForm, amount: Number(applyForm.amount) },
      (data) => `Used on ${String(data.invoice ?? "the invoice")}.`);
  }

  const held = credit.available + credit.reserved;
  return <OpsPage>
    <OpsPageHeader
      eyebrow="Customer credit"
      title={<span className="inline-flex flex-wrap items-center gap-2">{credit.customer_name}<OpsBadge tone={credit.status === "open" ? "info" : "neutral"} dot>{credit.status === "open" ? `${money(held, credit.currency)} held` : "Settled"}</OpsBadge></span>}
      description={credit.source === "advance"
        ? <>Advance payment: receipt <OpsMono>{credit.receipt_number ?? credit.source_document ?? "—"}</OpsMono>{credit.linked_invoice_reference ? <> · for <Link href={`/admin/finance/invoices/${encodeURIComponent(credit.linked_invoice_reference)}`} className="ops-cell-link"><OpsMono>{credit.linked_invoice_reference}</OpsMono></Link>, used on it when it is issued</> : null}</>
        : <>{customerCreditSourceLabels[credit.source]}: <Link href={`/admin/finance/invoices/${encodeURIComponent(credit.source_invoice_reference)}`} className="ops-cell-link"><OpsMono>{credit.source_invoice_number}</OpsMono></Link>{credit.source_document ? <> · {credit.source_document}</> : null}</>}
    />
    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

      <OpsSurface>
        <OpsDetailGrid columns={4}>
          <OpsDetailItem label="Credit">{money(credit.amount, credit.currency)}</OpsDetailItem>
          <OpsDetailItem label="Free to use"><strong>{money(credit.available, credit.currency)}</strong></OpsDetailItem>
          <OpsDetailItem label="Held for refunds">{money(credit.reserved, credit.currency)}</OpsDetailItem>
          <OpsDetailItem label="Refunded · used on invoices">{money(credit.refunded, credit.currency)} · {money(credit.applied, credit.currency)}</OpsDetailItem>
          {credit.note ? <OpsDetailItem label="Note" wide>{credit.note}</OpsDetailItem> : null}
        </OpsDetailGrid>
      </OpsSurface>

      <OpsSurface title="Refunds" flush={!refunds.length ? false : true}>
        {refunds.length ? <ul className="divide-y divide-[var(--admin-line)]">{refunds.map((refund) => <RefundRow key={refund.id} refund={refund} viewer={viewer} busy={busy} send={send}/>)}</ul>
          : <OpsEmptyState compact icon={<Undo2 size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No refunds yet" description="Ask for one below. Management approves every refund before it is paid."/>}
      </OpsSurface>

      {credit.available > 0.005 ? <div className="grid gap-[var(--ops-stack-gap,16px)] xl:grid-cols-2">
        <OpsSurface title="Pay it back" description={viewer.role === "management" ? "Your request is approved as you make it." : "Management approves it before it is paid."}>
          <form onSubmit={askForRefund} className="grid gap-3">
            <OpsField label={`Amount (${credit.currency})`}><input required type="number" inputMode="decimal" min="0.01" max={credit.available} step="0.01" value={refundForm.amount} onChange={(event) => setRefundForm({ ...refundForm, amount: event.target.value })}/></OpsField>
            <OpsField label="Reason"><input required minLength={4} maxLength={500} value={refundForm.reason} onChange={(event) => setRefundForm({ ...refundForm, reason: event.target.value })} placeholder="Shipment cancelled after payment, paid twice…"/></OpsField>
            <OpsField label="Pay to" hint="Bank, account name and number, or how the customer wants it"><textarea rows={2} maxLength={500} value={refundForm.payeeDetails} onChange={(event) => setRefundForm({ ...refundForm, payeeDetails: event.target.value })}/></OpsField>
            <div><OpsButton type="submit" variant="primary" disabled={busy}><Undo2 size={12}/>{viewer.role === "management" ? "Approve refund" : "Ask for refund"}</OpsButton></div>
          </form>
        </OpsSurface>
        <OpsSurface title="Use on another invoice" description={`The customer's open ${credit.currency} invoices.`}>
          {openInvoices.length ? <form onSubmit={useOnInvoice} className="grid gap-3">
            <OpsField label="Invoice"><select required value={applyForm.invoiceReference} onChange={(event) => {
              const invoice = openInvoices.find((item) => item.reference === event.target.value);
              setApplyForm({ invoiceReference: event.target.value, amount: invoice ? String(Math.min(credit.available, invoice.balance_due)) : applyForm.amount });
            }}>{openInvoices.map((invoice) => <option key={invoice.reference} value={invoice.reference}>{invoice.number} · {money(invoice.balance_due, credit.currency)} owed · due {dateLabel(invoice.due_date)}</option>)}</select></OpsField>
            <OpsField label={`Amount (${credit.currency})`}><input required type="number" inputMode="decimal" min="0.01" max={Math.min(credit.available, openInvoices.find((item) => item.reference === applyForm.invoiceReference)?.balance_due ?? credit.available)} step="0.01" value={applyForm.amount} onChange={(event) => setApplyForm({ ...applyForm, amount: event.target.value })}/></OpsField>
            <div><OpsButton type="submit" variant="secondary" disabled={busy}><ReceiptText size={12}/>Use credit</OpsButton></div>
          </form> : <OpsEmptyState compact icon={<ReceiptText size={17} strokeWidth={1.75} aria-hidden="true"/>} title="Nothing to use it on" description={`The customer has no ${credit.currency} invoice that still owes anything.`}/>}
        </OpsSurface>
      </div> : null}

      <OpsSurface title="History">
        <OpsTimeline entries={history.map((event) => ({
          id: event.id,
          title: event.detail,
          meta: `${dateLabel(event.created_at)} · ${event.actor_name}`,
          tone: event.kind === "refund_paid" || event.kind === "applied" ? "success" : event.kind === "refund_rejected" || event.kind === "refund_cancelled" ? "neutral" : event.kind === "created" ? "info" : "accent",
        }))} empty={<p className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Nothing yet.</p>}/>
      </OpsSurface>
    </div>
  </OpsPage>;
}

function RefundRow({ refund, viewer, busy, send }: {
  refund: FinanceRefund;
  viewer: Viewer;
  busy: boolean;
  send: (url: string, method: "POST" | "PATCH", body: Record<string, unknown>, success: (data: Record<string, unknown>) => string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"" | "reject" | "pay">("");
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState({ paidOn: nepalOperationalDate(), method: "bank_transfer", paymentReference: "" });
  const can = (action: RefundAction) => refundTransition(refund, action, { role: viewer.role, email: viewer.email, canManageFinance: true }).ok;
  const url = `/api/admin/finance/refunds/${encodeURIComponent(refund.id)}`;
  const act = (action: RefundAction, body: Record<string, unknown> = {}) => send(url, "PATCH", { action, ...body }, (data) =>
    action === "pay" ? `Refund ${String(data.number ?? "")} recorded as paid.` : action === "approve" ? "Refund approved." : action === "reject" ? "Refund rejected; the amount is back on the credit." : "Refund cancelled; the amount is back on the credit.");
  const ownRequest = viewer.email.trim().toLowerCase() === refund.requested_by_email.trim().toLowerCase();

  return <li className="grid gap-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-[var(--admin-ink)]">{money(refund.amount, refund.currency)}{refund.number ? <> · <OpsMono>{refund.number}</OpsMono></> : null}</p>
        <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{refund.reason}</p>
        {refund.payee_details ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Pay to: {refund.payee_details}</p> : null}
        <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">
          Asked for {dateLabel(refund.requested_at)} by {refund.requested_by_name}
          {refund.decided_by_name ? ` · ${refund.status === "rejected" ? "rejected" : refund.status === "cancelled" ? "cancelled" : "approved"} by ${refund.decided_by_name}` : ""}
          {refund.decision_note ? ` · ${refund.decision_note}` : ""}
          {refund.status === "paid" ? ` · paid ${dateLabel(refund.paid_on)} by ${refund.method ? financePaymentMethodLabels[refund.method].toLowerCase() : "—"}${refund.payment_reference ? ` (${refund.payment_reference})` : ""}` : ""}
        </p>
      </div>
      <OpsBadge tone={refundTone(refund.status)} dot>{refundStatusLabels[refund.status]}</OpsBadge>
    </div>

    {refund.status === "requested" || refund.status === "approved" ? <div className="flex flex-wrap items-center gap-2">
      {can("approve") ? <OpsButton size="sm" variant="primary" disabled={busy} onClick={() => act("approve")}><CheckCircle2 size={12}/>Approve</OpsButton> : null}
      {refund.status === "requested" && viewer.role === "management" && ownRequest ? <span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Another manager approves your own request.</span> : null}
      {refund.status === "requested" && viewer.role !== "management" ? <span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Waiting for Management to approve.</span> : null}
      {can("pay") ? <OpsButton size="sm" variant="primary" disabled={busy} onClick={() => setMode(mode === "pay" ? "" : "pay")}><Banknote size={12}/>Record as paid</OpsButton> : null}
      {can("reject") ? <OpsButton size="sm" variant="secondary" disabled={busy} onClick={() => setMode(mode === "reject" ? "" : "reject")}><XCircle size={12}/>Reject</OpsButton> : null}
      {can("cancel") ? <OpsButton size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Cancel this refund? The amount goes back on the credit.")) void act("cancel"); }}>Cancel refund</OpsButton> : null}
    </div> : null}

    {mode === "reject" ? <form className="grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={async (event) => { event.preventDefault(); if (await act("reject", { note })) setMode(""); }}>
      <OpsField label="Why it is rejected"><input required minLength={4} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></OpsField>
      <OpsButton type="submit" variant="danger" disabled={busy}>Reject refund</OpsButton>
    </form> : null}

    {mode === "pay" ? <form className="grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 sm:grid-cols-3" onSubmit={async (event) => {
      event.preventDefault();
      if (!window.confirm(`Record ${money(refund.amount, refund.currency)} as paid to ${refund.customer_name}? It gets a refund number and can't be undone.`)) return;
      if (await act("pay", paid)) setMode("");
    }}>
      <OpsField label="Paid on"><input required type="date" max={nepalOperationalDate()} value={paid.paidOn} onChange={(event) => setPaid({ ...paid, paidOn: event.target.value })}/></OpsField>
      <OpsField label="Paid by"><select value={paid.method} onChange={(event) => setPaid({ ...paid, method: event.target.value })}>{refundMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField>
      <OpsField label={paid.method === "cash" ? "Receipt (optional)" : "Bank, cheque or wallet reference"}><input required={paid.method !== "cash"} maxLength={200} value={paid.paymentReference} onChange={(event) => setPaid({ ...paid, paymentReference: event.target.value })}/></OpsField>
      <div className="sm:col-span-3"><OpsButton type="submit" variant="primary" disabled={busy}><HandCoins size={12}/>Record refund as paid</OpsButton></div>
    </form> : null}
  </li>;
}
