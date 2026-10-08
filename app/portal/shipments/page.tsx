import { Package } from "lucide-react";
import { getPortalAccess } from "../portal-auth";
import { listPortalShipments } from "../portal-data.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../portal-frame";
import { PortalShipmentsWorkspace } from "./portal-shipments-workspace";
import { portalText } from "../portal-i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipments", robots: { index: false, follow: false } };

export default async function PortalShipmentsPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const result = await listPortalShipments(access.session);
  return (
    <PortalShell
      session={access.session}
    >
      {result.kind === "ready"
        ? <PortalShipmentsWorkspace locale={access.session.locale} shipments={result.shipments}/>
        : <PortalWorkspaceUnavailable title={portalText(access.session.locale, "ships.title")} icon={<Package size={18}/>} locale={access.session.locale}/>}
    </PortalShell>
  );
}
