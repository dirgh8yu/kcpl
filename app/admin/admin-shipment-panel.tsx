"use client";

import { ArrowRight, ExternalLink, Truck } from "lucide-react";
import type { QuoteStatus } from "./admin-data";
import { shipmentStatusLabels, type ShipmentDetail, type ShipmentStatus } from "../shipment-types";
import { OpsBadge, OpsMono, OpsNotice } from "./operations-ui";

function statusTone(status: ShipmentStatus): "neutral" | "info" | "warning" | "violet" | "success" | "danger" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance") return "violet";
  if (status === "preparing") return "warning";
  if (["booking_confirmed", "in_transit", "out_for_delivery"].includes(status)) return "info";
  return "neutral";
}

function formatDateOnly(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }

/**
 * The enquiry's view of its shipment: where it stands, and the way into it.
 * Status, details, tracking updates and documents are all worked in the
 * shipment's own checklist; this used to be a second copy of those editors.
 */
export function AdminShipmentPanel({ shipment, quoteStatus }: { shipment: ShipmentDetail | null; quoteStatus: QuoteStatus }) {
  if (!shipment) {
    if (quoteStatus !== "won") return null;
    return <OpsNotice tone="success"><span className="inline-flex items-center gap-2"><Truck size={13}/>The shipment is being created. Reload this enquiry if its reference doesn’t appear.</span></OpsNotice>;
  }
  const job = `/admin/jobs/${encodeURIComponent(shipment.reference)}`;
  return <div className="enquiry-shipment-summary">
    <div className="enquiry-shipment-summary-head">
      <div>
        <p className="ops-eyebrow">Shipment</p>
        <p className="enquiry-shipment-summary-ref"><OpsMono>{shipment.reference}</OpsMono><OpsBadge tone={statusTone(shipment.status)} dot>{shipmentStatusLabels[shipment.status]}</OpsBadge></p>
      </div>
      <div className="job-form-actions">
        <a href={job} className="ops-button" data-variant="primary" data-size="sm">Open shipment<ArrowRight size={13} strokeWidth={1.75} aria-hidden="true"/></a>
        <a href={`/tracking?reference=${encodeURIComponent(shipment.reference)}`} target="_blank" rel="noreferrer" className="ops-button" data-variant="ghost" data-size="sm">Customer’s tracking page<ExternalLink size={12} strokeWidth={1.75} aria-hidden="true"/></a>
      </div>
    </div>
    <dl className="enquiry-shipment-summary-facts">
      <div><dt>Location</dt><dd>{shipment.current_location || "Not set"}</dd></div>
      <div><dt>ETA</dt><dd>{shipment.eta ? formatDateOnly(shipment.eta) : "Not set"}</dd></div>
      <div><dt>Carrier</dt><dd>{shipment.carrier || "Not chosen"}</dd></div>
      <div><dt>Updates posted</dt><dd>{shipment.events.length}</dd></div>
    </dl>
    <p className="ops-inspector-hint">Status, pickup, documents, customs, tracking updates and delivery are all done in the shipment.</p>
  </div>;
}
