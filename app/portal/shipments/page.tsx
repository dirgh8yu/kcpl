import { Package } from "lucide-react";
import { getPortalAccess } from "../portal-auth";
import { listPortalShipments } from "../portal-data.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../portal-frame";
import { PortalShipmentsWorkspace } from "./portal-shipments-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipments · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalShipmentsPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const result = await listPortalShipments(access.session);
  return (
    <PortalShell
      customerName={access.session.customerName}
      accountEmail={access.session.email}
      capabilities={access.session.capabilities}
    >
      {result.kind === "ready"
        ? <PortalShipmentsWorkspace shipments={result.shipments}/>
        : <PortalWorkspaceUnavailable eyebrow="Kapileshwor Cargo" title="Shipments" icon={<Package size={18}/>}/>}
    </PortalShell>
  );
}
