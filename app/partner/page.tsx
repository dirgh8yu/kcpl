import Link from "next/link";
import { Truck } from "lucide-react";
import { SignInLayout } from "../admin/sign-in-layout";
import { OpsBadge, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../admin/operations-ui";
import { shipmentStatusLabels, type ShipmentStatus } from "../shipment-types";
import { getPartnerAccess } from "./partner-auth";
import { listPartnerShipments } from "./partner-data.server";
import { PartnerLogin } from "./partner-login";
import { PartnerShell } from "./partner-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipments" };

function day(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

/** The shipments KCPL has shared with this partner, newest activity first. */
export default async function PartnerHome() {
  const access = await getPartnerAccess();
  if (access.kind === "unconfigured") return <SignInLayout title="KCPL partner portal" lead="The partner portal isn’t set up on this site yet."/>;
  if (access.kind === "signed-out") return <SignInLayout title="Sign in to the KCPL partner portal" help="No login yet? Ask your KCPL contact to add you."><PartnerLogin/></SignInLayout>;
  const shipments = await listPartnerShipments(access.session).catch(() => null);
  return <PartnerShell session={access.session}>
    <OpsPage>
      <OpsPageHeader eyebrow={access.session.partnerName} title="Shipments" description="The shipments KCPL has shared with you. Open one to post a milestone or send a document."/>
      <div className="ops-content">
        <OpsSurface title={shipments ? `${shipments.length} shipment${shipments.length === 1 ? "" : "s"}` : "Shipments"} flush>
          {shipments === null ? <OpsEmptyState compact icon={<Truck size={17} strokeWidth={1.75} aria-hidden="true"/>} title="Shipments didn’t load" description="Try again in a minute."/>
            : shipments.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
              <thead><tr><th>Shipment</th><th>Route</th><th>Status</th><th>ETA</th></tr></thead>
              <tbody>{shipments.map((shipment) => <tr key={shipment.reference}>
                <td data-cell="primary"><Link href={`/partner/shipments/${encodeURIComponent(shipment.reference)}`} className="ops-cell-primary"><OpsMono>{shipment.reference}</OpsMono></Link><span className="ops-cell-secondary">{shipment.role}{shipment.carrier_reference ? ` · ${shipment.carrier_reference}` : ""}</span></td>
                <td data-cell="route" data-label="Route">{shipment.origin || "Origin"} → {shipment.destination || "Destination"}</td>
                <td data-cell="meta" data-label="Status"><OpsBadge tone="info">{shipmentStatusLabels[shipment.status as ShipmentStatus] ?? shipment.status}</OpsBadge></td>
                <td data-cell="meta" data-label="ETA">{day(shipment.eta)}</td>
              </tr>)}</tbody>
            </table></OpsTableWrap>
              : <OpsEmptyState compact icon={<Truck size={17} strokeWidth={1.75} aria-hidden="true"/>} title="Nothing shared yet" description="Shipments appear here when KCPL adds you to them."/>}
        </OpsSurface>
      </div>
    </OpsPage>
  </PartnerShell>;
}
