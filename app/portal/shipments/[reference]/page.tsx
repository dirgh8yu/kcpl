import Link from "next/link";
import { AlarmClock, CircleDot, FileText, Package } from "lucide-react";
import {
  OpsBadge,
  OpsDetailGrid,
  OpsDetailItem,
  OpsDetailSection,
  OpsEmptyState,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsNotice,
  OpsSurface,
  OpsTimeline,
} from "../../../admin/operations-ui";
import { getPortalAccess } from "../../portal-auth";
import { getPortalShipment, type PortalShipmentDetail } from "../../portal-data.server";
import { freeTimeSummary } from "../../../shipment-free-time";
import { portalConfirmableDeliveryStatus } from "../../portal-access-policy";
import { portalTranslator, type PortalLocale } from "../../portal-i18n";
import { PortalDeliveryConfirmation } from "./portal-delivery-confirmation";
import { PortalLoginPage } from "../../portal-login-page";
import { PortalShell } from "../../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../../portal-frame";
import { PortalDocumentExchange } from "./portal-document-exchange";
import {
  portalDate,
  portalDateTime,
  portalDocumentLabel,
  portalFileSize,
  portalModeLabel,
  portalStatusLabel,
  portalStatusTone,
} from "../../portal-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalShipmentPage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const t = portalTranslator(access.session.locale);
  const { reference } = await params;
  const result = await getPortalShipment(access.session, decodeURIComponent(reference));

  return (
    <PortalShell
      session={access.session}
    >
      {result.kind === "ready"
        ? <ShipmentDetail detail={result.detail} canSend={access.session.capabilities.canSubmitRequests} locale={access.session.locale}/>
        : null}
      {result.kind === "missing" ? (
        <OpsPage>
          <OpsPageHeader eyebrow={t("overview.eyebrow")} title={t("ship.not_found_title")}/>
          <div className="ops-content">
            <OpsEmptyState
              kind="search"
              icon={<Package size={18}/>}
              title={t("ship.not_found_heading")}
              description={t("ship.not_found_description")}
              action={<Link href="/portal/shipments" className="ops-button" data-variant="primary" data-size="sm">{t("overview.all_shipments")}</Link>}
            />
          </div>
        </OpsPage>
      ) : null}
      {result.kind === "unavailable" ? (
        <PortalWorkspaceUnavailable eyebrow={t("overview.eyebrow")} title={t("common.shipment")} icon={<Package size={18}/>}/>
      ) : null}
    </PortalShell>
  );
}

function ShipmentDetail({ detail, canSend, locale }: { detail: PortalShipmentDetail; canSend: boolean; locale: PortalLocale }) {
  const t = portalTranslator(locale);
  const { shipment, events, documents, checklist, freeTime, confirmation } = detail;

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow={t("ship.eyebrow", { mode: portalModeLabel(shipment.mode, locale) })}
        title={<OpsMono>{shipment.reference}</OpsMono>}
        description={<span className="portal-lane">{shipment.origin || t("overview.origin")}<span className="portal-lane-arrow" aria-hidden="true">→</span>{shipment.destination || t("overview.destination")}</span>}
        meta={<>
          <span>{t("ship.opened", { date: portalDate(shipment.created_at) })}</span>
          <span>{t("ship.last_update", { when: portalDateTime(shipment.updated_at) })}</span>
        </>}
        actions={<>
          <OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status, locale)}</OpsBadge>
          <Link href="/portal/shipments" className="ops-button" data-variant="secondary" data-size="sm">{t("overview.all_shipments")}</Link>
        </>}
      />

      <div className="ops-content">
        <div className="ops-stack portal-stack">
          <PortalDeliveryConfirmation
            locale={locale}
            reference={shipment.reference}
            confirmedAt={confirmation?.confirmed_at ?? null}
            confirmedBy={confirmation?.received_by ?? null}
            canConfirm={canSend && portalConfirmableDeliveryStatus(shipment.status)}
          />

          {freeTime ? (
            <OpsSurface
              eyebrow={t("free_time.label")}
              title={freeTimeSummary(freeTime.freeTime, freeTime.status, locale)}
              description={freeTime.status.state === "expired"
                ? t("ship.free_time_expired_description")
                : t("ship.free_time_description")}
              priority={freeTime.status.state === "expired" ? "danger" : freeTime.status.state === "last_day" ? "warning" : "info"}
            >
              <OpsDetailGrid columns={3}>
                <OpsDetailItem label={t("ship.location")}>{freeTime.freeTime.location ?? t("ship.as_advised")}</OpsDetailItem>
                <OpsDetailItem label={t("free_time.deadline")}>{portalDate(freeTime.status.deadline)}</OpsDetailItem>
                <OpsDetailItem label={freeTime.status.state === "expired" ? t("ship.days_overdue") : t("ship.days_remaining")}>
                  <strong>{freeTime.status.state === "expired" ? freeTime.status.daysOverdue : freeTime.status.daysRemaining}</strong>
                </OpsDetailItem>
                {freeTime.freeTime.daily_charge !== null ? (
                  <OpsDetailItem label={t("ship.charge_after_expiry")}>
                    {t("ship.per_day", { currency: freeTime.freeTime.charge_currency ?? "", amount: freeTime.freeTime.daily_charge })}
                  </OpsDetailItem>
                ) : null}
                {freeTime.status.projectedCharge !== null ? (
                  <OpsDetailItem label={t("ship.accrued")}>
                    {freeTime.freeTime.charge_currency ?? ""} {freeTime.status.projectedCharge}
                  </OpsDetailItem>
                ) : null}
                <OpsDetailItem label={t("ship.allowance")}>{t("ship.allowance_days", { days: freeTime.freeTime.days ?? 0 })}</OpsDetailItem>
              </OpsDetailGrid>
              <p className="portal-footnote">
                <AlarmClock size={14} aria-hidden="true"/> {t("ship.free_time_footnote")}
              </p>
            </OpsSurface>
          ) : null}

          {shipment.customer_note ? (
            <OpsNotice tone="neutral">{shipment.customer_note}</OpsNotice>
          ) : null}

          <OpsSurface eyebrow={t("ship.movement_eyebrow")} title={t("ship.movement_title")}>
            <OpsDetailSection title={t("ship.route_section")} columns={3}>
              <OpsDetailItem label={t("overview.origin")}>{shipment.origin || t("common.none")}</OpsDetailItem>
              <OpsDetailItem label={t("overview.destination")}>{shipment.destination || t("common.none")}</OpsDetailItem>
              <OpsDetailItem label={t("ship.mode")}>{portalModeLabel(shipment.mode, locale)}</OpsDetailItem>
              <OpsDetailItem label={t("ship.current_location")}>{shipment.current_location || t("ship.not_reported")}</OpsDetailItem>
              <OpsDetailItem label={t("ship.eta")}>{portalDate(shipment.eta)}</OpsDetailItem>
              <OpsDetailItem label={t("ships.col_carrier")}>{shipment.carrier || t("ship.to_be_confirmed")}</OpsDetailItem>
              <OpsDetailItem label={t("ship.carrier_reference")}>
                {shipment.carrier_reference ? <OpsMono>{shipment.carrier_reference}</OpsMono> : t("common.none")}
              </OpsDetailItem>
              <OpsDetailItem label={t("common.status")}>{portalStatusLabel(shipment.status, locale)}</OpsDetailItem>
              <OpsDetailItem label={t("ship.opened_label")}>{portalDate(shipment.created_at)}</OpsDetailItem>
            </OpsDetailSection>
          </OpsSurface>

          <OpsSurface
            eyebrow={t("ship.progress_eyebrow")}
            title={t("ship.milestones_title")}
            description={t("ship.milestones_description")}
          >
            <OpsTimeline
              entries={events.map((event) => ({
                id: event.id,
                title: event.title,
                meta: portalDateTime(event.event_time),
                body: <>
                  {event.details ? <p className="portal-timeline-detail">{event.details}</p> : null}
                  {event.location ? <span className="portal-timeline-location">{event.location}</span> : null}
                </>,
                icon: <CircleDot size={12} strokeWidth={2} aria-hidden="true"/>,
              }))}
              empty={<OpsEmptyState
                compact
                kind="neutral"
                icon={<CircleDot size={18}/>}
                title={t("ship.no_milestones_title")}
                description={t("ship.no_milestones_description")}
              />}
            />
          </OpsSurface>

          <PortalDocumentExchange reference={shipment.reference} checklist={checklist} canSend={canSend} locale={locale}/>

          <OpsSurface
            eyebrow={t("overview.paperwork_eyebrow")}
            title={t("docs.title")}
            description={t("ship.documents_description")}
          >
            {documents.length ? (
              <ul className="portal-document-list">
                {documents.map((document) => (
                  <li key={document.id}>
                    <span className="portal-document-icon" aria-hidden="true"><FileText size={15} strokeWidth={1.75}/></span>
                    <span className="portal-document-main">
                      <strong>{portalDocumentLabel(document.document_type, locale)}</strong>
                      <span>
                        {document.filename} · {portalFileSize(document.size_bytes)} · {portalDate(document.uploaded_at)}
                        {document.from_customer ? t("ship.sent_by_you_suffix") : ""}
                      </span>
                    </span>
                    {document.from_customer ? (
                      <OpsBadge tone={document.review_state === "confirmed" ? "success" : document.review_state === "resend" ? "danger" : "info"}>
                        {document.review_state === "confirmed" ? t("docs.state_confirmed") : document.review_state === "resend" ? t("docs.state_resend") : t("docs.state_with_kcpl")}
                      </OpsBadge>
                    ) : null}
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
                title={t("ship.no_documents_title")}
                description={t("ship.no_documents_description")}
              />
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
