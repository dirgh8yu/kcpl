import Link from "next/link";
import { AlarmClock, ArrowRight, CheckCircle2, FileText, FileUp, MessageSquareQuote, Package, Receipt } from "lucide-react";
import {
  OpsBadge,
  OpsEmptyState,
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
import { portalNeeds, type PortalNeed } from "./portal-needs";
import { portalTranslator, type PortalLocale } from "./portal-i18n";
import { PortalTrackBar } from "./portal-shipment-track";

export function PortalOverview({ session, overview }: { session: PortalSession; overview: PortalOverviewData }) {
  const t = portalTranslator(session.locale);
  const locale = session.locale;
  const active = overview.shipments.filter((shipment) => shipment.status !== "delivered").slice(0, 8);
  const outstanding = overview.finance?.balances.filter((balance) => balance.outstanding > 0) ?? [];
  // Money is one row here: the amounts owed sit on it, so no separate
  // account box or second "to pay" row repeats them. (The app keeps both
  // rows; it lists overdue and open invoices on their own screen.)
  const needs = portalNeeds(overview).filter((need, _, all) => need.kind !== "pay_open" || !all.some((other) => other.kind === "pay_overdue"));
  const owed = outstanding.map((balance) => portalMoney(balance.outstanding, balance.currency)).join(" · ");

  return (
    <OpsPage>
      <OpsPageHeader
        title={session.customerName}
        actions={<Link href="/portal/requests" className="ops-button" data-variant="primary" data-size="sm">{t("overview.new_request")}</Link>}
      />

      <div className="ops-content">
        <div className="ops-stack portal-stack">
          <PortalNeedsList session={session} needs={needs} owed={owed} openInvoices={overview.finance?.openInvoices ?? 0}/>

          <OpsSurface
            title={t("overview.movements_title")}
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
                        <td data-cell="status"><span className="portal-status-stack"><OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status, locale)}</OpsBadge><PortalTrackBar status={shipment.status}/></span></td>
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

          {/* Released paperwork, when there is some. An empty box here would
              only repeat what the Documents tab already says. */}
          {overview.documents.length ? (
            <OpsSurface
              title={t("overview.paperwork_title")}
              action={<Link href="/portal/documents" className="ops-button" data-variant="secondary" data-size="sm">{t("overview.all_documents")}</Link>}
            >
              <ul className="portal-document-list">
                {overview.documents.slice(0, 3).map((document) => (
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
            </OpsSurface>
          ) : null}
        </div>
      </div>
    </OpsPage>
  );
}

/** "commercial invoice and packing list": paper names read as part of the
 * sentence they sit in. A name that starts with an acronym keeps its case. */
function documentList(types: string[], locale: PortalLocale) {
  const labels = types.map((type) => portalDocumentLabel(type, locale));
  if (locale !== "en") return labels.join(", ");
  const inline = labels.map((label) => /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label);
  return inline.length > 1 ? `${inline.slice(0, -1).join(", ")} and ${inline[inline.length - 1]}` : inline[0] ?? "";
}

/** One list of everything the customer has to do, most pressing first. Each
 * row's action is secondary: the panel's tone already says how urgent it is,
 * and a column of crimson buttons reads as nine alarms. */
function PortalNeedsList({ session, needs, owed, openInvoices }: { session: PortalSession; needs: PortalNeed[]; owed: string; openInvoices: number }) {
  const t = portalTranslator(session.locale);
  const locale = session.locale;
  if (!needs.length) {
    return <div className="portal-needs-clear" role="status">
      <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true"/>
      <strong>{t("needs.none_title")}</strong>
    </div>;
  }
  return <OpsSurface
    title={t("needs.title")}
    priority={needs.some((need) => need.kind === "pay_overdue" || (need.kind === "free_time" && need.status.state === "expired")) ? "danger" : "warning"}
    flush
  >
    <ul className="portal-document-list portal-action-list portal-needs">
      {needs.map((need) => {
        const key = `${need.kind}:${"reference" in need ? need.reference : ""}`;
        if (need.kind === "documents") return <li key={key}>
          <span className="portal-document-icon" aria-hidden="true"><FileUp size={15} strokeWidth={1.75}/></span>
          <span className="portal-document-main">
            <strong>{t("needs.documents", { documents: documentList(need.documentTypes, locale) })}</strong>
            <span><OpsMono>{need.reference}</OpsMono>{need.route ? ` · ${need.route}` : ""}</span>
          </span>
          <Link href={need.href} className="ops-button" data-variant="secondary" data-size="sm">{t("overview.send_now")}</Link>
        </li>;
        if (need.kind === "pay_overdue" || need.kind === "pay_open") return <li key={key}>
          <span className="portal-document-icon" aria-hidden="true"><Receipt size={15} strokeWidth={1.75}/></span>
          <span className="portal-document-main">
            <strong>{need.kind === "pay_overdue"
              ? (need.count === 1 ? t("needs.pay_overdue_one") : t("needs.pay_overdue", { count: need.count }))
              : (need.count === 1 ? t("needs.pay_open_one") : t("needs.pay_open", { count: need.count }))}</strong>
            <span>{owed ? `${openInvoices === 1 ? t("overview.open_invoices_one") : t("overview.open_invoices", { count: openInvoices })} · ${t("needs.pay_owed", { amounts: owed })}` : t("needs.pay_detail")}</span>
          </span>
          <Link href={need.href} className="ops-button" data-variant="secondary" data-size="sm">{t("overview.view_invoices")}</Link>
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
            <span><OpsMono>{need.reference}</OpsMono>{need.route ? ` · ${need.route}` : ""}</span>
          </span>
          <Link href={need.href} className="ops-button" data-variant="secondary" data-size="sm">{t("overview.open")}</Link>
        </li>;
      })}
    </ul>
  </OpsSurface>;
}
