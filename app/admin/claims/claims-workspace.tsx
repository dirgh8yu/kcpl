"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { claimBadge, claimKindLabels, claimNoticeDaysLeft, claimStatusLabels, type CargoClaim } from "../../cargo-claims";
import { OpsBadge, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../operations-ui";
import { dateLabel, money } from "../finance/credits/credits-format";

/** Soonest notice deadline first; filed claims after, oldest first. */
function urgency(claim: CargoClaim, today: string) {
  const left = claimNoticeDaysLeft(claim, today);
  return left !== null ? left : 10_000 + (Date.parse(claim.filed_on ?? claim.created_at) / 86_400_000 || 0);
}

export function ClaimsWorkspace({ open, closed, today }: { open: CargoClaim[]; closed: CargoClaim[]; today: string }) {
  const rows = [...open].sort((a, b) => urgency(a, today) - urgency(b, today));
  const dueSoon = open.filter((claim) => { const left = claimNoticeDaysLeft(claim, today); return left !== null && left <= 1; });
  const fromCustomers = open.filter((claim) => claim.reported_source === "customer" && claim.status === "reported");
  return <OpsPage>
    <OpsPageHeader eyebrow="Shipments" title="Claims" description="Damage, shortage, loss and delay claims. Notice has to reach the carrier or insurer before the deadline, or the claim is lost."/>
    <div className="ops-content-wide ops-stack">
      <OpsMetricStrip columns={3}>
        <OpsMetric label="Open claims" value={String(open.length)} detail={open.length ? `${open.filter((claim) => claim.status === "filed").length} filed, waiting on an answer` : "None"}/>
        <OpsMetric label="Notice due today or late" value={String(dueSoon.length)} detail={dueSoon.length ? "Give notice now" : "None"}/>
        <OpsMetric label="New from customers" value={String(fromCustomers.length)} detail={fromCustomers.length ? "Reported in the portal or app" : "None"}/>
      </OpsMetricStrip>

      <OpsSurface title="Open claims" flush>
        {rows.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
          <thead><tr><th>Shipment</th><th>Claim</th><th className="text-right">Claimed</th><th>Where it is</th></tr></thead>
          <tbody>{rows.map((claim) => {
            const badge = claimBadge(claim, today);
            return <tr key={claim.id}>
              <td data-cell="primary"><Link href={`/admin/jobs/${encodeURIComponent(claim.shipment_reference)}?step=problems#shipment-claims`} className="ops-cell-ref ops-mono">{claim.shipment_reference}</Link><span className="ops-cell-secondary">{claim.customer_name ?? "—"}</span></td>
              <td data-cell="route"><span className="ops-cell-primary">{claimKindLabels[claim.kind]} · {claim.number}</span><span className="ops-cell-secondary">Found {dateLabel(claim.noticed_on)}{claim.reported_source === "customer" ? " · from the customer" : ""}</span></td>
              <td data-cell="amount" data-label="Claimed" className="text-right tabular-nums">{claim.claimed_amount ? money(claim.claimed_amount, claim.currency) : "—"}</td>
              <td data-cell="status"><OpsBadge tone={badge.tone} dot>{badge.label}</OpsBadge></td>
            </tr>;
          })}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact kind="healthy" icon={<ShieldAlert size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No open claims" description="A claim opened on a Job File, or reported by a customer, appears here until it is closed."/>}
      </OpsSurface>

      {closed.length ? <OpsSurface title="Closed recently" flush>
        <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
          <thead><tr><th>Shipment</th><th>Claim</th><th className="text-right">To the customer</th><th>Outcome</th></tr></thead>
          <tbody>{closed.map((claim) => <tr key={claim.id}>
            <td data-cell="primary"><Link href={`/admin/jobs/${encodeURIComponent(claim.shipment_reference)}?step=problems#shipment-claims`} className="ops-cell-ref ops-mono">{claim.shipment_reference}</Link><span className="ops-cell-secondary">{claim.customer_name ?? "—"}</span></td>
            <td data-cell="route"><span className="ops-cell-primary">{claimKindLabels[claim.kind]} · {claim.number}</span></td>
            <td data-cell="amount" data-label="To the customer" className="text-right tabular-nums">{claim.compensation_amount ? money(claim.compensation_amount, claim.currency) : "—"}</td>
            <td data-cell="status"><OpsBadge tone={claim.status === "settled" ? "success" : claim.status === "rejected" ? "danger" : "neutral"}>{claimStatusLabels[claim.status]}</OpsBadge></td>
          </tr>)}</tbody>
        </table></OpsTableWrap>
      </OpsSurface> : null}
    </div>
  </OpsPage>;
}
