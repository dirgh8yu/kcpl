import { Send } from "lucide-react";
import { getPortalAccess } from "../portal-auth";
import { listPortalQuotes } from "../portal-data.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../portal-frame";
import { PortalRequestsWorkspace } from "./portal-requests-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes & requests · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalRequestsPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const result = await listPortalQuotes(access.session);
  return (
    <PortalShell
      customerName={access.session.customerName}
      accountEmail={access.session.email}
      capabilities={access.session.capabilities}
    >
      {result.kind === "ready"
        ? <PortalRequestsWorkspace quotes={result.quotes} requests={result.requests} capabilities={access.session.capabilities}/>
        : <PortalWorkspaceUnavailable eyebrow="Kapileshwor Cargo" title="Quotes & requests" icon={<Send size={18}/>}/>}
    </PortalShell>
  );
}
