"use client";

import Link from "next/link";
import { Landmark } from "lucide-react";
import { depositStageBadge, depositsOutstanding, type ContainerDeposit, DEPOSIT_CLAIM_DAYS, DEPOSIT_REFUND_DAYS } from "../../container-deposits";
import type { DepositRegisterRow } from "../../container-deposits.server";
import { OpsBadge, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../operations-ui";
import { dateLabel, money, totalsByCurrency } from "../finance/credits/credits-format";

/** Most urgent first: refunds overdue, claims late, claims due, waiting, boxes still out. */
function urgency(row: DepositRegisterRow) {
  const stage = row.stage;
  if (stage.stage === "claimed") return stage.overdue ? 0 : 3;
  if (stage.stage === "to_claim") return stage.late ? 1 : 2;
  return 4;
}

export function DepositsWorkspace({ open, closed }: { open: DepositRegisterRow[]; closed: ContainerDeposit[] }) {
  const rows = [...open].sort((a, b) => urgency(a) - urgency(b) || a.deposit.paid_on.localeCompare(b.deposit.paid_on));
  const toClaim = open.filter((row) => row.stage.stage === "to_claim");
  const overdue = open.filter((row) => row.stage.stage === "claimed" && row.stage.overdue);
  // A deposit the customer paid goes back to them: it's with the line, but it isn't KCPL's money.
  const ours = open.filter((row) => row.deposit.paid_by === "kcpl");
  const theirs = open.length - ours.length;
  const outstanding = depositsOutstanding(ours.map((row) => row.deposit));
  return <OpsPage>
    <OpsPageHeader eyebrow="Shipments" title="Container deposits" description={`Money paid to shipping lines to release boxes, until it comes back. Claim within ${DEPOSIT_CLAIM_DAYS} days of the last empty going back; a refund not in ${DEPOSIT_REFUND_DAYS} days after the claim is overdue.`}/>
    <div className="ops-content-wide ops-stack">
      <OpsMetricStrip columns={3}>
        <OpsMetric label="KCPL’s money with the lines" value={outstanding.length ? totalsByCurrency(outstanding) : "Nothing"} detail={`${ours.length} deposit${ours.length === 1 ? "" : "s"}${theirs ? ` · ${theirs} more paid by customers` : ""}`}/>
        <OpsMetric label="Empties back, claim now" value={String(toClaim.length)} detail={toClaim.length ? "Ask the line for the refund" : "None"}/>
        <OpsMetric label="Refunds overdue" value={String(overdue.length)} detail={overdue.length ? "Chase the line" : "None"}/>
      </OpsMetricStrip>

      <OpsSurface title="Open deposits" flush>
        {rows.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
          <thead><tr><th>Shipment</th><th>Paid to</th><th className="text-right">Deposit</th><th className="text-right">Expect back</th><th>Where it is</th></tr></thead>
          <tbody>{rows.map(({ deposit, stage, expected }) => {
            const badge = depositStageBadge(stage);
            return <tr key={deposit.id}>
              <td data-cell="primary"><Link href={`/admin/jobs/${encodeURIComponent(deposit.shipment_reference)}?step=transit#shipment-deposits`} className="ops-cell-ref ops-mono">{deposit.shipment_reference}</Link><span className="ops-cell-secondary">{deposit.customer_name ?? "—"}</span></td>
              <td data-cell="route"><span className="ops-cell-primary">{deposit.shipping_line}</span><span className="ops-cell-secondary">Paid {dateLabel(deposit.paid_on)}{deposit.bl_number ? ` · BL ${deposit.bl_number}` : ""}</span></td>
              <td data-cell="amount" data-label="Deposit" className="text-right font-semibold tabular-nums text-[var(--admin-ink)]">{money(deposit.amount, deposit.currency)}</td>
              <td data-cell="meta" data-label="Expect back" className="text-right tabular-nums">{money(expected.expected_back, deposit.currency)}{expected.deduction > 0 ? <span className="ops-cell-secondary">{money(expected.deduction, deposit.currency)} detention</span> : null}</td>
              <td data-cell="status"><OpsBadge tone={badge.tone} dot>{badge.label}</OpsBadge></td>
            </tr>;
          })}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact kind="healthy" icon={<Landmark size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No deposits with the lines" description="A deposit recorded on a Job File appears here until it is refunded."/>}
      </OpsSurface>

      {closed.length ? <OpsSurface title="Closed recently" flush>
        <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
          <thead><tr><th>Shipment</th><th>Paid to</th><th className="text-right">Deposit</th><th className="text-right">Came back</th><th>Closed</th></tr></thead>
          <tbody>{closed.map((deposit) => <tr key={deposit.id}>
            <td data-cell="primary"><Link href={`/admin/jobs/${encodeURIComponent(deposit.shipment_reference)}?step=transit#shipment-deposits`} className="ops-cell-ref ops-mono">{deposit.shipment_reference}</Link><span className="ops-cell-secondary">{deposit.customer_name ?? "—"}</span></td>
            <td data-cell="route"><span className="ops-cell-primary">{deposit.shipping_line}</span></td>
            <td data-cell="amount" data-label="Deposit" className="text-right tabular-nums">{money(deposit.amount, deposit.currency)}</td>
            <td data-cell="meta" data-label="Came back" className="text-right tabular-nums">{deposit.status === "refunded" ? money(deposit.amount_refunded ?? 0, deposit.currency) : "Written off"}{deposit.deduction ? <span className="ops-cell-secondary">{money(deposit.deduction, deposit.currency)} kept</span> : null}</td>
            <td data-cell="meta" data-label="Closed">{dateLabel(deposit.status === "refunded" ? deposit.refunded_on : deposit.written_off_on)}</td>
          </tr>)}</tbody>
        </table></OpsTableWrap>
      </OpsSurface> : null}
    </div>
  </OpsPage>;
}
