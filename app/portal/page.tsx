import { Package } from "lucide-react";
import { getPortalAccess } from "./portal-auth";
import { getPortalOverview } from "./portal-data.server";
import { PortalLoginPage } from "./portal-login-page";
import { PortalOverview } from "./portal-overview";
import { PortalShell } from "./portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "./portal-frame";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "KCPL Customer Portal",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const result = await getPortalOverview(access.session);
  return (
    <PortalShell
      customerName={access.session.customerName}
      accountEmail={access.session.email}
      capabilities={access.session.capabilities}
    >
      {result.kind === "ready"
        ? <PortalOverview session={access.session} overview={result.overview}/>
        : <PortalWorkspaceUnavailable eyebrow="Kapileshwor Cargo" title={access.session.customerName} icon={<Package size={18}/>}/>}
    </PortalShell>
  );
}
