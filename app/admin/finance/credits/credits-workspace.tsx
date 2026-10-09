"use client";

import Link from "next/link";
import { HandCoins } from "lucide-react";
import type { FinanceCustomerCredit, FinanceRefund } from "../finance-data";
import { customerCreditSourceLabels, refundStatusLabels } from "../refund-policy";
import { OpsBadge, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsMono, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
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
            <td data-cell="meta" data-label="From"><OpsMono>{credit.source_invoice_number}</OpsMono><span className="ops-cell-secondary">{customerCreditSourceLabels[credit.source]}</span></td>
            <td data-cell="amount" data-label="Free to use" className="font-semibold tabular-nums text-[var(--admin-ink)]">{money(credit.available, credit.currency)}</td>
            <td data-cell="meta" data-label="Held for refunds" className="tabular-nums">{credit.reserved ? money(credit.reserved, credit.currency) : "—"}</td>
            <td data-cell="meta" data-label="Since">{dateLabel(credit.created_at)}</td>
          </tr>)}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact kind="healthy" icon={<HandCoins size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No credit held for anyone" description="A credit appears here when a paid invoice is credited, or a customer pays more than they owe."/>}
      </OpsSurface>

      {settled.length ? <OpsSurface title="Recent refunds" flush><RefundTable refunds={settled}/></OpsSurface> : null}
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
