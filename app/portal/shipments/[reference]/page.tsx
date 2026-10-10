import Link from "next/link";
import { CircleDot, FileText, Package } from "lucide-react";
import {
  OpsBadge,
  OpsDetailGrid,
  OpsDetailItem,
  OpsEmptyState,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsNotice,
  OpsSurface,
  OpsTimeline,
} from "../../../admin/operations-ui";
import { getPortalAccess } from "../../portal-auth";
import { getPortalShipment, type PortalContainerView, type PortalShipmentDetail } from "../../portal-data.server";
import { containerSizeTypeLabels } from "../../../shipment-containers";
import { freeTimeSummary } from "../../../shipment-free-time";
import { portalConfirmableDeliveryStatus } from "../../portal-access-policy";
import { portalTranslator, type PortalLocale } from "../../portal-i18n";
import { PortalDeliveryConfirmation } from "./portal-delivery-confirmation";
import { PortalLoginPage } from "../../portal-login-page";
import { PortalShell } from "../../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../../portal-frame";
import { PortalDocumentExchange } from "./portal-document-exchange";
import { PortalDeliveryRating } from "./portal-delivery-rating";
import { ShipmentThread } from "../../../shipment-thread";
import { deliveryRatable } from "../../portal-delivery-rating";
import { portalDeliveryRating } from "../../portal-delivery-rating.server";
import { portalProofOfDelivery } from "../../portal-proof-of-delivery.server";
import type { PortalProofOfDelivery } from "../../portal-proof-of-delivery";
import { PortalProofOfDeliveryCard } from "./portal-proof-of-delivery";
import { PortalClaims } from "./portal-claims";
import { listPortalClaims } from "../../portal-claims.server";
import type { PortalClaimView } from "../../../cargo-claims";
import { nepalOperationalDate } from "../../../invoice-effective-status";
import {
  portalDate,
  portalDateTime,
  portalDocumentLabel,
  portalFileSize,
  portalModeLabel,
} from "../../portal-format";
import { PortalShipmentTrack } from "../../portal-shipment-track";
import { portalTrackPosition } from "../../portal-track";
import { recordTitle } from "../../../record-title";

export const dynamic = "force-dynamic";
/** The tab names the record, so a row of open tabs and the history read as
 *  a list of shipments and invoices rather than the same word repeated. */
export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  const name = recordTitle((await params).reference);
  return { title: name, robots: { index: false, follow: false } };
}

export default async function PortalShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ send?: string | string[] }>;
}) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const t = portalTranslator(access.session.locale);
  const { reference } = await params;
  // "KCPL needs your packing list" links here with ?send=packing_list.
  const send = (await searchParams).send;
  const requested = typeof send === "string" && /^[a-z_]{2,40}$/.test(send) ? send : null;
  const result = await getPortalShipment(access.session, decodeURIComponent(reference));
  const delivered = result.kind === "ready" && deliveryRatable(result.detail.shipment.status);
  const [rating, proof] = delivered && result.kind === "ready"
    ? await Promise.all([
        portalDeliveryRating(access.session, result.detail.shipment.reference),
        portalProofOfDelivery(access.session, result.detail.shipment.reference),
      ])
    : [null, null];
  const rated = !delivered || rating !== null;
  const claims = result.kind === "ready" ? await listPortalClaims(access.session, result.detail.shipment.reference).catch(() => null) : null;

  return (
    <PortalShell
      session={access.session}
    >
      {result.kind === "ready"
        ? <ShipmentDetail detail={result.detail} canSend={access.session.capabilities.canSubmitRequests} canRate={!rated} proof={proof} claims={claims ?? []} locale={access.session.locale} requested={requested}/>
        : null}
      {result.kind === "missing" ? (
        <OpsPage>
          <OpsPageHeader title={t("ship.not_found_title")}/>
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
        <PortalWorkspaceUnavailable title={t("common.shipment")} icon={<Package size={18}/>} locale={access.session.locale}/>
      ) : null}
    </PortalShell>
  );
}

function ShipmentDetail({ detail, canSend, canRate, proof, claims, locale, requested }: { detail: PortalShipmentDetail; canSend: boolean; canRate: boolean; proof: PortalProofOfDelivery | null; claims: PortalClaimView[]; locale: PortalLocale; requested: string | null }) {
  const t = portalTranslator(locale);
  const { shipment, events, documents, checklist, freeTime, confirmation } = detail;
  // Only paper the customer can send counts: a bill of lading KCPL prepares
  // is not something asked of them.
  const waiting = checklist.some((row) => row.uploadable && (row.state === "needed" || row.state === "resend"));
  const exception = portalTrackPosition(shipment.status) < 0;
  const exchange = <PortalDocumentExchange reference={shipment.reference} checklist={checklist} canSend={canSend} locale={locale} requested={requested}/>;

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
      >
        {/* The status, drawn as where the shipment is on its way. The way back
            to the list is the Shipments tab, lit above. */}
        <PortalShipmentTrack status={shipment.status} locale={locale} note={shipment.customer_note}/>
      </OpsPageHeader>

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
            // The title says how many days are left and where; the facts
            // below are only what it does not.
            <OpsSurface
              title={freeTimeSummary(freeTime.freeTime, freeTime.status, locale)}
              priority={freeTime.status.state === "expired" ? "danger" : freeTime.status.state === "last_day" ? "warning" : "info"}
            >
              <OpsDetailGrid columns={4}>
                <OpsDetailItem label={t("free_time.deadline")}>{portalDate(freeTime.status.deadline)}</OpsDetailItem>
                {freeTime.freeTime.daily_charge !== null ? (
                  <OpsDetailItem label={t("ship.charge_after_expiry")}>
                    {t("ship.per_day", { currency: freeTime.freeTime.charge_currency ?? "", amount: freeTime.freeTime.daily_charge })}
                  </OpsDetailItem>
                ) : null}
                {freeTime.status.projectedCharge ? (
                  <OpsDetailItem label={t("ship.accrued")}>
                    {freeTime.freeTime.charge_currency ?? ""} {freeTime.status.projectedCharge}
                  </OpsDetailItem>
                ) : null}
                {freeTime.freeTime.days ? (
                  <OpsDetailItem label={t("ship.allowance")}>{t("ship.allowance_days", { days: freeTime.freeTime.days })}</OpsDetailItem>
                ) : null}
              </OpsDetailGrid>
            </OpsSurface>
          ) : null}

          {detail.containers.length ? <PortalContainers containers={detail.containers} locale={locale}/> : null}

          {detail.dutyEstimate ? <OpsSurface title={t("ship.duty_title")} description={t("ship.duty_lead")}>
            <OpsDetailGrid columns={4}>
              <OpsDetailItem label={t("ship.duty_customs")}>{portalNpr(detail.dutyEstimate.duty)}</OpsDetailItem>
              {detail.dutyEstimate.excise ? <OpsDetailItem label={t("ship.duty_excise")}>{portalNpr(detail.dutyEstimate.excise)}</OpsDetailItem> : null}
              <OpsDetailItem label={t("ship.duty_vat")}>{portalNpr(detail.dutyEstimate.vat)}</OpsDetailItem>
              {detail.dutyEstimate.levies ? <OpsDetailItem label={t("ship.duty_other")}>{portalNpr(detail.dutyEstimate.levies)}</OpsDetailItem> : null}
              <OpsDetailItem label={t("ship.duty_total")}><strong>{portalNpr(detail.dutyEstimate.total)}</strong></OpsDetailItem>
            </OpsDetailGrid>
          </OpsSurface> : null}

          {/* On a shipment that needs attention the note is the reason, and it
              sits in the alert under the title. */}
          {shipment.customer_note && !exception ? (
            <OpsNotice tone="neutral">{shipment.customer_note}</OpsNotice>
          ) : null}

          {/* What the customer owes KCPL comes before what KCPL reports. */}
          {waiting ? exchange : null}

          {/* Route, mode, status and the opening date are in the header. Only
              what KCPL has recorded is listed; nothing reads "not reported". */}
          {shipment.current_location || shipment.eta || shipment.carrier || shipment.carrier_reference ? (
            <OpsSurface title={t("ship.movement_title")}>
              <OpsDetailGrid columns={4}>
                {shipment.current_location ? <OpsDetailItem label={t("ship.current_location")}>{shipment.current_location}</OpsDetailItem> : null}
                {shipment.eta ? <OpsDetailItem label={t("ship.eta")}>{portalDate(shipment.eta)}</OpsDetailItem> : null}
                {shipment.carrier ? <OpsDetailItem label={t("ships.col_carrier")}>{shipment.carrier}</OpsDetailItem> : null}
                {shipment.carrier_reference ? <OpsDetailItem label={t("ship.carrier_reference")}><OpsMono>{shipment.carrier_reference}</OpsMono></OpsDetailItem> : null}
              </OpsDetailGrid>
            </OpsSurface>
          ) : null}

          <OpsSurface title={t("ship.milestones_title")}>
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

          {proof ? <PortalProofOfDeliveryCard reference={shipment.reference} proof={proof} locale={locale}/> : null}

          {canRate ? <PortalDeliveryRating reference={shipment.reference} locale={locale}/> : null}

          <PortalClaims reference={shipment.reference} claims={claims} canSend={canSend} today={nepalOperationalDate()} locale={locale}/>

          <ShipmentThread
            endpoint={`/api/portal/shipments/${encodeURIComponent(shipment.reference)}/messages`}
            viewer="customer"
            labels={{
              title: t("msg.title"),
              placeholder: t("msg.placeholder"),
              send: t("msg.send"),
              sending: t("msg.sending"),
              failed: t("msg.failed"),
              loadFailed: t("msg.load_failed"),
            }}
          />

          {/* Released and sent paperwork, once there is some. Until then the
              request list above is where documents come up. */}
          {documents.length ? (
            <OpsSurface title={t("docs.title")}>
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
            </OpsSurface>
          ) : null}

          {waiting ? null : exchange}
        </div>
      </div>
    </OpsPage>
  );
}

/** Each container, where it is, and the days left to return the empty when that is the customer's to do. */
function PortalContainers({ containers, locale }: { containers: PortalContainerView[]; locale: PortalLocale }) {
  const t = portalTranslator(locale);
  const counting = containers.filter((container) => container.detention && container.detention.state !== "not_set");
  const overdue = counting.some((container) => container.stage !== "returned" && container.detention?.state === "expired");
  const lastDay = counting.some((container) => container.stage !== "returned" && container.detention?.state === "last_day");
  const depot = containers.find((container) => container.return_depot)?.return_depot ?? null;
  function line(container: PortalContainerView) {
    const status = container.detention;
    if (!status || status.state === "not_set" || container.stage === "at_port") return null;
    const amount = status.projectedCharge;
    if (container.stage === "returned") {
      return status.daysOverdue > 0 && amount !== null ? { tone: "danger" as const, text: t("ship.container_returned_late", { days: status.daysOverdue, currency: container.detention_currency ?? "", amount }) } : null;
    }
    if (status.state === "expired") return { tone: "danger" as const, text: amount !== null ? t("ship.container_overdue", { days: status.daysOverdue, currency: container.detention_currency ?? "", amount }) : t("ship.container_overdue_no_rate", { days: status.daysOverdue }) };
    if (status.state === "last_day") return { tone: "warning" as const, text: t("ship.container_last_day") };
    return { tone: status.daysRemaining <= 2 ? "warning" as const : "info" as const, text: status.daysRemaining === 1 ? t("ship.container_one_day") : t("ship.container_days_left", { days: status.daysRemaining }) };
  }
  const stageLabel = { at_port: t("ship.container_at_port"), out: t("ship.container_out"), returned: t("ship.container_returned") };
  return <OpsSurface
    title={t("ship.containers_title")}
    description={counting.length ? (depot ? t("ship.containers_lead", { depot }) : t("ship.containers_lead_no_depot")) : undefined}
    priority={overdue ? "danger" : lastDay ? "warning" : "normal"}
  >
    <ul className="portal-container-list">{containers.map((container) => {
      const status = line(container);
      return <li key={container.number}>
        <div className="min-w-0">
          <strong><OpsMono>{container.number}</OpsMono></strong>
          <span>{containerSizeTypeLabels[container.size_type]} · {stageLabel[container.stage]}</span>
        </div>
        {status ? <OpsBadge tone={status.tone} dot>{status.text}</OpsBadge> : null}
      </li>;
    })}</ul>
  </OpsSurface>;
}

function portalNpr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value);
}
