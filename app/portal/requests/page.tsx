import { Send } from "lucide-react";
import { getPortalAccess } from "../portal-auth";
import { listPortalQuotes } from "../portal-data.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../portal-frame";
import { PortalRequestsWorkspace } from "./portal-requests-workspace";
import { listPortalPrices } from "../portal-instant-price.server";
import { portalQaPreviewEnabled } from "../portal-qa-preview";
import { portalText } from "../portal-i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes & requests", robots: { index: false, follow: false } };

export default async function PortalRequestsPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const [result, prices] = await Promise.all([
    listPortalQuotes(access.session),
    // Agreed prices are extra: if they can't be read, the page works without them.
    portalQaPreviewEnabled() ? Promise.resolve([]) : listPortalPrices(access.session).catch(() => []),
  ]);
  return (
    <PortalShell
      session={access.session}
    >
      {result.kind === "ready"
        ? <PortalRequestsWorkspace locale={access.session.locale} quotes={result.quotes} requests={result.requests} capabilities={access.session.capabilities} prices={prices}/>
        : <PortalWorkspaceUnavailable title={portalText(access.session.locale, "req.title")} icon={<Send size={18}/>} locale={access.session.locale}/>}
    </PortalShell>
  );
}
