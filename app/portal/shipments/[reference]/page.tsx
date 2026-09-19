import Link from "next/link";
import { CircleDot, FileText, Package } from "lucide-react";
import {
  OpsBadge,
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

  const { reference } = await params;
  const result = await getPortalShipment(access.session, decodeURIComponent(reference));

  return (
    <PortalShell
      customerName={access.session.customerName}
      accountEmail={access.session.email}
      capabilities={access.session.capabilities}
    >
      {result.kind === "ready"
        ? <ShipmentDetail detail={result.detail} canSend={access.session.capabilities.canSubmitRequests}/>
        : null}
      {result.kind === "missing" ? (
        <OpsPage>
          <OpsPageHeader eyebrow="Kapileshwor Cargo" title="Shipment not found"/>
          <div className="ops-content">
            <OpsEmptyState
              kind="search"
              icon={<Package size={18}/>}
              title="That shipment is not on your account"
              description="Check the reference, or open the shipment from your list."
              action={<Link href="/portal/shipments" className="ops-button" data-variant="primary" data-size="sm">All shipments</Link>}
            />
          </div>
        </OpsPage>
      ) : null}
      {result.kind === "unavailable" ? (
        <PortalWorkspaceUnavailable eyebrow="Kapileshwor Cargo" title="Shipment" icon={<Package size={18}/>}/>
      ) : null}
    </PortalShell>
  );
}

function ShipmentDetail({ detail, canSend }: { detail: PortalShipmentDetail; canSend: boolean }) {
  const { shipment, events, documents, checklist } = detail;

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow={`Shipment · ${portalModeLabel(shipment.mode)}`}
        title={<OpsMono>{shipment.reference}</OpsMono>}
        description={<span className="portal-lane">{shipment.origin || "Origin"}<span className="portal-lane-arrow" aria-hidden="true">→</span>{shipment.destination || "Destination"}</span>}
        meta={<>
          <span>Opened {portalDate(shipment.created_at)}</span>
          <span>Last update {portalDateTime(shipment.updated_at)}</span>
        </>}
        actions={<>
          <OpsBadge tone={portalStatusTone(shipment.status)} dot>{portalStatusLabel(shipment.status)}</OpsBadge>
          <Link href="/portal/shipments" className="ops-button" data-variant="secondary" data-size="sm">All shipments</Link>
        </>}
      />

      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {shipment.customer_note ? (
            <OpsNotice tone="neutral">{shipment.customer_note}</OpsNotice>
          ) : null}

          <OpsSurface eyebrow="Movement" title="Shipment details">
            <OpsDetailSection title="Route and handling" columns={3}>
              <OpsDetailItem label="Origin">{shipment.origin || "—"}</OpsDetailItem>
              <OpsDetailItem label="Destination">{shipment.destination || "—"}</OpsDetailItem>
              <OpsDetailItem label="Mode">{portalModeLabel(shipment.mode)}</OpsDetailItem>
              <OpsDetailItem label="Current location">{shipment.current_location || "Not reported"}</OpsDetailItem>
              <OpsDetailItem label="Estimated arrival">{portalDate(shipment.eta)}</OpsDetailItem>
              <OpsDetailItem label="Carrier">{shipment.carrier || "To be confirmed"}</OpsDetailItem>
              <OpsDetailItem label="Carrier reference">
                {shipment.carrier_reference ? <OpsMono>{shipment.carrier_reference}</OpsMono> : "—"}
              </OpsDetailItem>
              <OpsDetailItem label="Status">{portalStatusLabel(shipment.status)}</OpsDetailItem>
              <OpsDetailItem label="Opened">{portalDate(shipment.created_at)}</OpsDetailItem>
            </OpsDetailSection>
          </OpsSurface>

          <OpsSurface
            eyebrow="Progress"
            title="Milestones"
            description="Updates recorded by the KCPL operations team and by carrier tracking feeds."
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
                title="No milestones recorded yet"
                description="Updates appear here as KCPL progresses the shipment."
              />}
            />
          </OpsSurface>

          <PortalDocumentExchange reference={shipment.reference} checklist={checklist} canSend={canSend}/>

          <OpsSurface
            eyebrow="Paperwork"
            title="Documents"
            description="Documents KCPL has released to you, and the ones you have sent."
          >
            {documents.length ? (
              <ul className="portal-document-list">
                {documents.map((document) => (
                  <li key={document.id}>
                    <span className="portal-document-icon" aria-hidden="true"><FileText size={15} strokeWidth={1.75}/></span>
                    <span className="portal-document-main">
                      <strong>{portalDocumentLabel(document.document_type)}</strong>
                      <span>
                        {document.filename} · {portalFileSize(document.size_bytes)} · {portalDate(document.uploaded_at)}
                        {document.from_customer ? " · sent by you" : ""}
                      </span>
                    </span>
                    {document.from_customer ? (
                      <OpsBadge tone={document.review_state === "confirmed" ? "success" : document.review_state === "resend" ? "danger" : "info"}>
                        {document.review_state === "confirmed" ? "Confirmed" : document.review_state === "resend" ? "Send again" : "With KCPL"}
                      </OpsBadge>
                    ) : null}
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
                title="No documents yet"
                description="Documents KCPL releases to you, and anything you send, will be listed here."
              />
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
