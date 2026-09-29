import Link from "next/link";
import { AlarmClock, ArrowRight, CheckCircle2, FileText, FileUp, MessageSquareQuote, Package, Receipt } from "lucide-react";
import {
  OpsBadge,
  OpsEmptyState,
  OpsMetric,
  OpsMetricStrip,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
  OpsTableWrap,
} from "../admin/operations-ui";
import { OpsKpiRail, OpsRailMetric } from "../admin/ops-register";
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
import { portalNeeds, type PortalNeed } from "./portal-needs";
import { portalTranslator } from "./portal-i18n";

export function PortalOverview({ session, overview }: { session: PortalSession; overview: PortalOverviewData }) {
  const t = portalTranslator(session.locale);
  const locale = session.locale;
  const active = overview.shipments.filter((shipment) => shipment.status !== "delivered").slice(0, 8);
  const outstanding = overview.finance?.balances.filter((balance) => balance.outstanding > 0) ?? [];
  const needs = portalNeeds(overview);

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
          <PortalNeedsList session={session} needs={needs}/>

          {/* Where things stand. What needs the customer is the list above, so
              documents and free time are not counted a second time here. */}
          <OpsKpiRail label={t("overview.eyebrow")}>
            <OpsRailMetric label={t("overview.kpi_active")} value={overview.activeCount}/>
            <OpsRailMetric label={t("overview.kpi_in_transit")} value={overview.inTransitCount} tone="success"/>
            <OpsRailMetric label={t("overview.kpi_arriving")} value={overview.arrivingCount} tone="info"/>
            <OpsRailMetric label={t("overview.kpi_attention")} value={overview.attentionCount} tone="danger"/>
          </OpsKpiRail>

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
                <table className="ops-table ops-register-table portal-stack-table" data-row-link="">
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
                        <td data-cell="primary">
                          <Link href={`/portal/shipments/${encodeURIComponent(shipment.reference)}`} className="portal-row-link">
                            <OpsMono>{shipment.reference}</OpsMono>
                          </Link>
                          <span className="portal-cell-detail">{portalModeLabel(shipment.mode, locale)}</span>
                        </td>
                        <td data-cell="route">
                          <span className="portal-lane">{shipment.origin || t("overview.origin")}<span className="portal-lane-arrow" aria-hidden="true">→</span>{shipment.destination || t("overview.destination")}</span>
                          {shipment.current_location ? <span className="portal-cell-detail">{t("overview.now_at", { location: shipment.current_location })}</span> : null}
                        </td>
                        <td data-cell="status"><OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status, locale)}</OpsBadge></td>
                        <td data-cell="meta" data-label={t("overview.col_eta")}>{portalDate(shipment.eta)}</td>
                        <td data-cell="meta" data-label={t("overview.col_last_update")}>{portalDateTime(shipment.updated_at)}</td>
                        <td data-cell="open">
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

/** One list of everything the customer has to do, most pressing first. */
function PortalNeedsList({ session, needs }: { session: PortalSession; needs: PortalNeed[] }) {
  const t = portalTranslator(session.locale);
  const locale = session.locale;
  if (!needs.length) {
    return <div className="portal-needs-clear" role="status">
      <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true"/>
      <span><strong>{t("needs.none_title")}</strong> {t("needs.none_description")}</span>
    </div>;
  }
  return <OpsSurface
    title={t("needs.title")}
    description={needs.length === 1 ? t("needs.count_one") : t("needs.count", { count: needs.length })}
    priority={needs.some((need) => need.kind === "pay_overdue" || (need.kind === "free_time" && need.status.state === "expired")) ? "danger" : "warning"}
    flush
  >
    <ul className="portal-document-list portal-action-list portal-needs">
      {needs.map((need) => {
        const key = `${need.kind}:${"reference" in need ? need.reference : ""}`;
        if (need.kind === "documents") return <li key={key}>
          <span className="portal-document-icon" aria-hidden="true"><FileUp size={15} strokeWidth={1.75}/></span>
          <span className="portal-document-main">
            <strong>{t("needs.documents", { documents: need.documentTypes.map((type) => portalDocumentLabel(type, locale)).join(", ") })}</strong>
            <span><OpsMono>{need.reference}</OpsMono>{need.route ? ` · ${need.route}` : ""}</span>
          </span>
          <Link href={need.href} className="ops-button" data-variant="primary" data-size="sm">{t("overview.send_now")}</Link>
        </li>;
        if (need.kind === "pay_overdue" || need.kind === "pay_open") return <li key={key}>
          <span className="portal-document-icon" aria-hidden="true"><Receipt size={15} strokeWidth={1.75}/></span>
          <span className="portal-document-main">
            <strong>{need.kind === "pay_overdue"
              ? (need.count === 1 ? t("needs.pay_overdue_one") : t("needs.pay_overdue", { count: need.count }))
              : (need.count === 1 ? t("needs.pay_open_one") : t("needs.pay_open", { count: need.count }))}</strong>
            <span>{t("needs.pay_detail")}</span>
          </span>
          <Link href={need.href} className="ops-button" data-variant={need.kind === "pay_overdue" ? "primary" : "secondary"} data-size="sm">{t("overview.view_invoices")}</Link>
        </li>;
        if (need.kind === "quote") return <li key={key}>
          <span className="portal-document-icon" aria-hidden="true"><MessageSquareQuote size={15} strokeWidth={1.75}/></span>
          <span className="portal-document-main">
            <strong>{t("needs.quote", { reference: need.reference })}</strong>
            <span>{need.route}{need.amount !== null ? ` · ${portalMoney(need.amount, need.currency)}` : ""}{need.validUntil ? ` · ${t("needs.valid_until", { date: portalDate(need.validUntil) })}` : ""}</span>
          </span>
          <Link href={need.href} className="ops-button" data-variant="secondary" data-size="sm">{t("needs.review")}</Link>
        </li>;
        return <li key={key}>
          <span className="portal-document-icon" aria-hidden="true"><AlarmClock size={15} strokeWidth={1.75}/></span>
          <span className="portal-document-main">
            <strong>{freeTimeSummary({ location: need.location, days: null, started_on: null, daily_charge: null, charge_currency: null, bearer: "undecided", note: null, updated_at: null, updated_by: null }, need.status, locale)}</strong>
            <span><OpsMono>{need.reference}</OpsMono>{need.route ? ` · ${need.route}` : ""} · {t("needs.free_time_detail")}</span>
          </span>
          <Link href={need.href} className="ops-button" data-variant="secondary" data-size="sm">{t("overview.open")}</Link>
        </li>;
      })}
    </ul>
  </OpsSurface>;
}
