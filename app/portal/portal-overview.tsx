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
import { portalTranslator } from "./portal-i18n";

export function PortalOverview({ session, overview }: { session: PortalSession; overview: PortalOverviewData }) {
  const t = portalTranslator(session.locale);
  const locale = session.locale;
  const active = overview.shipments.filter((shipment) => shipment.status !== "delivered").slice(0, 8);
  const outstanding = overview.finance?.balances.filter((balance) => balance.outstanding > 0) ?? [];

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow={t("overview.eyebrow")}
        title={session.customerName}
        description={t("overview.description")}
        meta={<>
          <span>{t("overview.signed_in_as", { email: session.email })}</span>
          <span>{overview.shipments.length === 1 ? t("overview.on_record_one") : t("overview.on_record", { count: overview.shipments.length })}</span>
        </>}
        actions={<Link href="/portal/requests" className="ops-button" data-variant="primary" data-size="sm">{t("overview.new_request")}</Link>}
      />

      <div className="ops-content">
        <div className="ops-stack portal-stack">
          <OpsKpiStrip>
            <OpsKpiCard label={t("overview.kpi_active")} value={overview.activeCount} icon={<Package size={16} strokeWidth={1.75}/>} tone="accent"/>
            <OpsKpiCard label={t("overview.kpi_in_transit")} value={overview.inTransitCount} icon={<Truck size={16} strokeWidth={1.75}/>} tone="info"/>
            <OpsKpiCard label={t("overview.kpi_arriving")} value={overview.arrivingCount} icon={<CalendarClock size={16} strokeWidth={1.75}/>} tone="neutral"/>
            <OpsKpiCard
              label={t("overview.kpi_free_time")}
              value={overview.freeTime.length}
              icon={<AlarmClock size={16} strokeWidth={1.75}/>}
              tone={overview.freeTime.some((row) => row.status.state === "expired") ? "danger" : overview.freeTime.length ? "warning" : "success"}
              detail={overview.freeTime.length ? t("overview.kpi_free_time_clear") : t("overview.kpi_free_time_none")}
            />
            <OpsKpiCard
              label={t("overview.kpi_documents")}
              value={overview.outstandingCount}
              icon={<FileUp size={16} strokeWidth={1.75}/>}
              tone={overview.outstandingCount > 0 ? "warning" : "success"}
              detail={overview.outstandingCount > 0 ? t("overview.kpi_documents_waiting") : t("overview.kpi_documents_none")}
            />
            <OpsKpiCard
              label={t("overview.kpi_attention")}
              value={overview.attentionCount}
              icon={<AlertTriangle size={16} strokeWidth={1.75}/>}
              tone={overview.attentionCount > 0 ? "danger" : "success"}
              detail={overview.attentionCount > 0 ? t("overview.kpi_attention_working") : t("overview.kpi_attention_none")}
            />
          </OpsKpiStrip>

          {overview.freeTime.length ? (
            <OpsSurface
              eyebrow={t("overview.free_time_eyebrow")}
              title={t("overview.free_time_title")}
              description={t("overview.free_time_description")}
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
                      }, row.status, locale)}</strong>
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
                      {t("overview.open")}
                    </Link>
                  </li>
                ))}
              </ul>
            </OpsSurface>
          ) : null}

          {overview.outstanding.length ? (
            <OpsSurface
              eyebrow={t("overview.outstanding_eyebrow")}
              title={t("overview.outstanding_title")}
              description={t("overview.outstanding_description")}
              priority="warning"
              flush
            >
              <ul className="portal-document-list portal-action-list">
                {overview.outstanding.map((entry) => (
                  <li key={entry.reference}>
                    <span className="portal-document-icon" aria-hidden="true"><FileUp size={15} strokeWidth={1.75}/></span>
                    <span className="portal-document-main">
                      <strong>{entry.rows.map((row) => portalDocumentLabel(row.document_type, locale)).join(", ")}</strong>
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
                      {t("overview.send_now")}
                    </Link>
                  </li>
                ))}
              </ul>
            </OpsSurface>
          ) : null}

          {overview.finance && outstanding.length ? (
            <OpsSurface
              eyebrow={t("overview.account_eyebrow")}
              title={t("overview.account_title")}
              description={`${overview.finance.openInvoices === 1 ? t("overview.open_invoices_one") : t("overview.open_invoices", { count: overview.finance.openInvoices })}${overview.finance.overdueInvoices ? ` · ${t("overview.overdue_count", { count: overview.finance.overdueInvoices })}` : ""}`}
              action={<Link href="/portal/invoices" className="ops-button" data-variant="secondary" data-size="sm">{t("overview.view_invoices")}</Link>}
              priority={overview.finance.overdueInvoices > 0 ? "warning" : "normal"}
            >
              <OpsMetricStrip columns={Math.min(4, Math.max(1, outstanding.length))}>
                {outstanding.map((balance) => (
                  <OpsMetric
                    key={balance.currency}
                    icon={<Receipt size={14} strokeWidth={1.75}/>}
                    label={t("overview.currency_outstanding", { currency: balance.currency })}
                    value={portalMoney(balance.outstanding, balance.currency)}
                    detail={balance.overdue > 0 ? t("overview.amount_overdue", { amount: portalMoney(balance.overdue, balance.currency) }) : t("overview.nothing_overdue")}
                  />
                ))}
              </OpsMetricStrip>
            </OpsSurface>
          ) : null}

          <OpsSurface
            eyebrow={t("overview.movements_eyebrow")}
            title={t("overview.movements_title")}
            description={t("overview.movements_description")}
            action={<Link href="/portal/shipments" className="ops-button" data-variant="secondary" data-size="sm">{t("overview.all_shipments")}</Link>}
            flush
          >
            {active.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{t("overview.col_reference")}</th>
                      <th>{t("common.route")}</th>
                      <th>{t("common.status")}</th>
                      <th>{t("overview.col_eta")}</th>
                      <th>{t("overview.col_last_update")}</th>
                      <th><span className="portal-sr-only">{t("overview.open")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((shipment) => (
                      <tr key={shipment.reference}>
                        <td>
                          <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-link">
                            <OpsMono>{shipment.reference}</OpsMono>
                          </Link>
                          <span className="portal-cell-detail">{portalModeLabel(shipment.mode, locale)}</span>
                        </td>
                        <td>
                          <span className="portal-lane">{shipment.origin || t("overview.origin")}<span className="portal-lane-arrow" aria-hidden="true">→</span>{shipment.destination || t("overview.destination")}</span>
                          {shipment.current_location ? <span className="portal-cell-detail">{t("overview.now_at", { location: shipment.current_location })}</span> : null}
                        </td>
                        <td><OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status, locale)}</OpsBadge></td>
                        <td>{portalDate(shipment.eta)}</td>
                        <td>{portalDateTime(shipment.updated_at)}</td>
                        <td>
                          <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-open" aria-label={t("overview.open_shipment", { reference: shipment.reference })}>
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
                  title={overview.shipments.length ? t("overview.empty_delivered_title") : t("overview.empty_none_title")}
                  description={overview.shipments.length
                    ? t("overview.empty_delivered_description")
                    : t("overview.empty_none_description")}
                  action={<Link href="/portal/requests" className="ops-button" data-variant="primary" data-size="sm">{t("overview.request_quote")}</Link>}
                />
              </div>
            )}
          </OpsSurface>

          <OpsSurface
            eyebrow={t("overview.paperwork_eyebrow")}
            title={t("overview.paperwork_title")}
            description={t("overview.paperwork_description")}
            action={<Link href="/portal/documents" className="ops-button" data-variant="secondary" data-size="sm">{t("overview.all_documents")}</Link>}
          >
            {overview.documents.length ? (
              <ul className="portal-document-list">
                {overview.documents.map((document) => (
                  <li key={`${document.shipment_reference}:${document.id}`}>
                    <span className="portal-document-icon" aria-hidden="true"><FileText size={15} strokeWidth={1.75}/></span>
                    <span className="portal-document-main">
                      <strong>{portalDocumentLabel(document.document_type, locale)}</strong>
                      <span>{document.filename} · {portalFileSize(document.size_bytes)} · <OpsMono>{document.shipment_reference}</OpsMono></span>
                    </span>
                    <a
                      className="ops-button"
                      data-variant="secondary"
                      data-size="sm"
                      href={`/api/portal/documents/${encodeURIComponent(document.shipment_reference)}/${encodeURIComponent(document.id)}`}
                    >
                      {t("common.download")}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <OpsEmptyState
                compact
                kind="neutral"
                icon={<FileText size={18}/>}
                title={t("overview.no_documents_title")}
                description={t("overview.no_documents_description")}
              />
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
