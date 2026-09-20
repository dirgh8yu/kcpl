import Link from "next/link";
import { AlarmClock, AlertTriangle, ArrowRight, CalendarClock, FileText, FileUp, Package, Receipt, Truck } from "lucide-react";
import {
  OpsBadge,
  OpsEmptyState,
  OpsKpiCard,
  OpsKpiStrip,
  OpsMetric,
  OpsMetricStrip,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
  OpsTableWrap,
} from "../admin/operations-ui";
import type { PortalOverview as PortalOverviewData } from "./portal-data.server";
import { freeTimeSummary } from "../shipment-free-time";
import {
  portalDate,
  portalDateTime,
  portalDocumentLabel,
  portalFileSize,
  portalModeLabel,
  portalMoney,
  portalStatusLabel,
  portalStatusTone,
} from "./portal-format";
import type { PortalSession } from "./portal-auth";

export function PortalOverview({ session, overview }: { session: PortalSession; overview: PortalOverviewData }) {
  const active = overview.shipments.filter((shipment) => shipment.status !== "delivered").slice(0, 8);
  const outstanding = overview.finance?.balances.filter((balance) => balance.outstanding > 0) ?? [];

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Kapileshwor Cargo"
        title={session.customerName}
        description="Your live shipments, released documents and account position with KCPL."
        meta={<>
          <span>Signed in as {session.email}</span>
          <span>{overview.shipments.length} shipment{overview.shipments.length === 1 ? "" : "s"} on record</span>
        </>}
        actions={<Link href="/portal/requests" className="ops-button" data-variant="primary" data-size="sm">New freight request</Link>}
      />

      <div className="ops-content">
        <div className="ops-stack portal-stack">
          <OpsKpiStrip>
            <OpsKpiCard label="Active shipments" value={overview.activeCount} icon={<Package size={16} strokeWidth={1.75}/>} tone="accent"/>
            <OpsKpiCard label="In transit" value={overview.inTransitCount} icon={<Truck size={16} strokeWidth={1.75}/>} tone="info"/>
            <OpsKpiCard label="Arriving in 7 days" value={overview.arrivingCount} icon={<CalendarClock size={16} strokeWidth={1.75}/>} tone="neutral"/>
            <OpsKpiCard
              label="Free time running out"
              value={overview.freeTime.length}
              icon={<AlarmClock size={16} strokeWidth={1.75}/>}
              tone={overview.freeTime.some((row) => row.status.state === "expired") ? "danger" : overview.freeTime.length ? "warning" : "success"}
              detail={overview.freeTime.length ? "Clear these to avoid charges" : "No clocks close to expiry"}
            />
            <OpsKpiCard
              label="Documents needed"
              value={overview.outstandingCount}
              icon={<FileUp size={16} strokeWidth={1.75}/>}
              tone={overview.outstandingCount > 0 ? "warning" : "success"}
              detail={overview.outstandingCount > 0 ? "KCPL is waiting on you" : "Nothing outstanding"}
            />
            <OpsKpiCard
              label="Needs attention"
              value={overview.attentionCount}
              icon={<AlertTriangle size={16} strokeWidth={1.75}/>}
              tone={overview.attentionCount > 0 ? "danger" : "success"}
              detail={overview.attentionCount > 0 ? "KCPL is working on these" : "No exceptions raised"}
            />
          </OpsKpiStrip>

          {overview.freeTime.length ? (
            <OpsSurface
              eyebrow="Costing you money"
              title="Free time running out"
              description="Storage and demurrage start when the carrier's free days end. Clearing the cargo before then avoids the charge."
              priority={overview.freeTime.some((row) => row.status.state === "expired") ? "danger" : "warning"}
              flush
            >
              <ul className="portal-document-list portal-action-list">
                {overview.freeTime.map((row) => (
                  <li key={row.reference}>
                    <span className="portal-document-icon" aria-hidden="true"><AlarmClock size={15} strokeWidth={1.75}/></span>
                    <span className="portal-document-main">
                      <strong>{freeTimeSummary({
                        location: row.location,
                        days: null,
                        started_on: null,
                        daily_charge: null,
                        charge_currency: null,
                        bearer: "undecided",
                        note: null,
                        updated_at: null,
                        updated_by: null,
                      }, row.status)}</strong>
                      <span>
                        <OpsMono>{row.reference}</OpsMono>
                        {row.origin ? ` · ${row.origin} → ${row.destination}` : ""}
                      </span>
                    </span>
                    <Link
                      href={`/portal/shipments/${encodeURIComponent(row.reference)}`}
                      className="ops-button"
                      data-variant="secondary"
                      data-size="sm"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            </OpsSurface>
          ) : null}

          {overview.outstanding.length ? (
            <OpsSurface
              eyebrow="Action needed"
              title="Paperwork KCPL is waiting on"
              description="Send these from the shipment so KCPL can keep the cargo moving."
              priority="warning"
              flush
            >
              <ul className="portal-document-list portal-action-list">
                {overview.outstanding.map((entry) => (
                  <li key={entry.reference}>
                    <span className="portal-document-icon" aria-hidden="true"><FileUp size={15} strokeWidth={1.75}/></span>
                    <span className="portal-document-main">
                      <strong>{entry.rows.map((row) => portalDocumentLabel(row.document_type)).join(", ")}</strong>
                      <span>
                        <OpsMono>{entry.reference}</OpsMono>
                        {entry.origin ? ` · ${entry.origin} → ${entry.destination}` : ""}
                      </span>
                    </span>
                    <Link
                      href={`/portal/shipments/${encodeURIComponent(entry.reference)}#documents`}
                      className="ops-button"
                      data-variant="primary"
                      data-size="sm"
                    >
                      Send now
                    </Link>
                  </li>
                ))}
              </ul>
            </OpsSurface>
          ) : null}

          {overview.finance && outstanding.length ? (
            <OpsSurface
              eyebrow="Account"
              title="Outstanding with KCPL"
              description={`${overview.finance.openInvoices} open invoice${overview.finance.openInvoices === 1 ? "" : "s"}${overview.finance.overdueInvoices ? ` · ${overview.finance.overdueInvoices} overdue` : ""}`}
              action={<Link href="/portal/invoices" className="ops-button" data-variant="secondary" data-size="sm">View invoices</Link>}
              priority={overview.finance.overdueInvoices > 0 ? "warning" : "normal"}
            >
              <OpsMetricStrip columns={Math.min(4, Math.max(1, outstanding.length))}>
                {outstanding.map((balance) => (
                  <OpsMetric
                    key={balance.currency}
                    icon={<Receipt size={14} strokeWidth={1.75}/>}
                    label={`${balance.currency} outstanding`}
                    value={portalMoney(balance.outstanding, balance.currency)}
                    detail={balance.overdue > 0 ? `${portalMoney(balance.overdue, balance.currency)} overdue` : "Nothing overdue"}
                  />
                ))}
              </OpsMetricStrip>
            </OpsSurface>
          ) : null}

          <OpsSurface
            eyebrow="Movements"
            title="Active shipments"
            description="Every movement KCPL is currently handling for your account."
            action={<Link href="/portal/shipments" className="ops-button" data-variant="secondary" data-size="sm">All shipments</Link>}
            flush
          >
            {active.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Route</th>
                      <th>Status</th>
                      <th>ETA</th>
                      <th>Last update</th>
                      <th><span className="portal-sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((shipment) => (
                      <tr key={shipment.reference}>
                        <td>
                          <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-link">
                            <OpsMono>{shipment.reference}</OpsMono>
                          </Link>
                          <span className="portal-cell-detail">{portalModeLabel(shipment.mode)}</span>
                        </td>
                        <td>
                          <span className="portal-lane">{shipment.origin || "Origin"}<span className="portal-lane-arrow" aria-hidden="true">→</span>{shipment.destination || "Destination"}</span>
                          {shipment.current_location ? <span className="portal-cell-detail">Now at {shipment.current_location}</span> : null}
                        </td>
                        <td><OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status)}</OpsBadge></td>
                        <td>{portalDate(shipment.eta)}</td>
                        <td>{portalDateTime(shipment.updated_at)}</td>
                        <td>
                          <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-open" aria-label={`Open shipment ${shipment.reference}`}>
                            <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true"/>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <div className="portal-empty-wrap">
                <OpsEmptyState
                  kind="healthy"
                  icon={<Package size={18}/>}
                  title={overview.shipments.length ? "Nothing in transit right now" : "No shipments yet"}
                  description={overview.shipments.length
                    ? "Every movement on your account has been delivered. Completed shipments stay available under Shipments."
                    : "Once KCPL books your first shipment it will appear here with live milestones."}
                  action={<Link href="/portal/requests" className="ops-button" data-variant="primary" data-size="sm">Request a quote</Link>}
                />
              </div>
            )}
          </OpsSurface>

          <OpsSurface
            eyebrow="Paperwork"
            title="Recently released documents"
            description="Documents KCPL has released to your account."
            action={<Link href="/portal/documents" className="ops-button" data-variant="secondary" data-size="sm">All documents</Link>}
          >
            {overview.documents.length ? (
              <ul className="portal-document-list">
                {overview.documents.map((document) => (
                  <li key={`${document.shipment_reference}:${document.id}`}>
                    <span className="portal-document-icon" aria-hidden="true"><FileText size={15} strokeWidth={1.75}/></span>
                    <span className="portal-document-main">
                      <strong>{portalDocumentLabel(document.document_type)}</strong>
                      <span>{document.filename} · {portalFileSize(document.size_bytes)} · <OpsMono>{document.shipment_reference}</OpsMono></span>
                    </span>
                    <a
                      className="ops-button"
                      data-variant="secondary"
                      data-size="sm"
                      href={`/api/portal/documents/${encodeURIComponent(document.shipment_reference)}/${encodeURIComponent(document.id)}`}
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <OpsEmptyState
                compact
                kind="neutral"
                icon={<FileText size={18}/>}
                title="No documents released yet"
                description="Bills of lading, air waybills and customs paperwork appear here once KCPL releases them to your account."
              />
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
