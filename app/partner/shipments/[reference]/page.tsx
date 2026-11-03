import { notFound, redirect } from "next/navigation";
import { CircleDot, FileText, Receipt } from "lucide-react";
import { OpsBadge, OpsDetailGrid, OpsDetailItem, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsSurface, OpsTimeline } from "../../../admin/operations-ui";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../../../shipment-document-types";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import { freightModeLabel } from "../../../admin/freight-mode";
import { getPartnerAccess } from "../../partner-auth";
import { getPartnerShipment } from "../../partner-data.server";
import { PartnerShell } from "../../partner-shell";
import { PartnerShipmentActions } from "./partner-shipment-actions";
import { PartnerBills } from "./partner-bills";
import { listPartnerBills } from "../../partner-bills.server";
import { nepalOperationalDate } from "../../../invoice-effective-status";
import { mergeTimeline, portalTimeline } from "../../../shipment-timeline";

export const dynamic = "force-dynamic";

function day(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date);
}

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  return { title: decodeURIComponent((await params).reference).toUpperCase() };
}

export default async function PartnerShipmentPage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getPartnerAccess();
  if (access.kind !== "authorized") redirect("/partner");
  const { reference } = await params;
  const detail = await getPartnerShipment(access.session, decodeURIComponent(reference));
  if (!detail) notFound();
  const { shipment, events, documents } = detail;
  const bills = await listPartnerBills(access.session, shipment.reference).catch(() => []);
  const activity = mergeTimeline([
    ...portalTimeline(events, documents, null),
    ...bills.map((bill) => ({
      id: `bill:${bill.reference}`,
      at: bill.invoice_date,
      kind: "bill" as const,
      title: `Invoice ${bill.invoice_number}`,
      detail: `${bill.currency} ${bill.total.toFixed(2)} · ${bill.status_label}`,
      location: null,
      audience: "partner" as const,
    })),
  ]);
  return <PartnerShell session={access.session}>
    <OpsPage>
      <OpsPageHeader
        eyebrow={`${shipment.role} · ${access.session.partnerName}`}
        title={<OpsMono>{shipment.reference}</OpsMono>}
        description={`${shipment.origin || "Origin"} → ${shipment.destination || "Destination"}`}
        meta={<><span>{shipmentStatusLabels[shipment.status as ShipmentStatus] ?? shipment.status}</span>{shipment.eta ? <span>ETA {day(shipment.eta)}</span> : null}</>}
      />
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          <PartnerShipmentActions reference={shipment.reference}/>
          {shipment.carrier_reference || shipment.mode ? <OpsSurface title="Shipment details">
            <OpsDetailGrid columns={3}>
              {shipment.mode ? <OpsDetailItem label="Mode">{freightModeLabel(shipment.mode)}</OpsDetailItem> : null}
              {shipment.carrier_reference ? <OpsDetailItem label="Carrier reference"><OpsMono>{shipment.carrier_reference}</OpsMono></OpsDetailItem> : null}
              <OpsDetailItem label="Your role">{shipment.role}</OpsDetailItem>
            </OpsDetailGrid>
          </OpsSurface> : null}
          <OpsSurface title="Activity" description="Milestones, documents and invoices in one record.">
            <OpsTimeline
              entries={activity.map((entry) => ({ id: entry.id, title: entry.title, meta: when(entry.at), body: <>{entry.detail ? <p className="portal-timeline-detail">{entry.detail}</p> : null}{entry.location ? <span className="portal-timeline-location">{entry.location}</span> : null}</>, icon: entry.kind === "document" ? <FileText size={12} strokeWidth={2} aria-hidden="true"/> : entry.kind === "bill" ? <Receipt size={12} strokeWidth={2} aria-hidden="true"/> : <CircleDot size={12} strokeWidth={2} aria-hidden="true"/> }))}
              empty={<OpsEmptyState compact icon={<CircleDot size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No activity yet" description="Post the first milestone above."/>}
            />
          </OpsSurface>
          <OpsSurface title="Documents you sent" description="KCPL reviews each one before it goes any further.">
            {documents.length ? <ul className="portal-container-list">{documents.map((document) => <li key={document.id}>
              <div className="min-w-0"><strong>{document.filename}</strong><span>{shipmentDocumentTypeLabels[document.document_type as ShipmentDocumentType] ?? "Document"} · {when(document.uploaded_at)}</span></div>
              <OpsBadge tone={document.review_status === "rejected" ? "danger" : document.review_status === "verified" ? "success" : "info"}>{document.review_status === "rejected" ? "Sent back" : document.review_status === "verified" ? "Accepted" : "With KCPL"}</OpsBadge>
            </li>)}</ul> : <p className="portal-footnote m-0">Nothing sent yet.</p>}
          </OpsSurface>
          <PartnerBills reference={shipment.reference} bills={bills} today={nepalOperationalDate()}/>
        </div>
      </div>
    </OpsPage>
  </PartnerShell>;
}
