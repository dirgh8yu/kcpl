import { Receipt } from "lucide-react";
import { OpsEmptyState, OpsPage, OpsPageHeader } from "../../admin/operations-ui";
import { getPortalAccess } from "../portal-auth";
import { listPortalInvoices } from "../portal-data.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../portal-frame";
import { PortalInvoicesWorkspace } from "./portal-invoices-workspace";
import { portalText } from "../portal-i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices", robots: { index: false, follow: false } };

export default async function PortalInvoicesPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const result = await listPortalInvoices(access.session);
  return (
    <PortalShell
      session={access.session}
    >
      {result.kind === "ready"
        ? <PortalInvoicesWorkspace locale={access.session.locale} invoices={result.invoices} summary={result.summary}/>
        : null}
      {result.kind === "forbidden" ? (
        <OpsPage>
          <OpsPageHeader title={portalText(access.session.locale, "inv.title")}/>
          <div className="ops-content">
            <OpsEmptyState
              kind="unavailable"
              icon={<Receipt size={18}/>}
              title={portalText(access.session.locale, "invd.no_access_title")}
              description={portalText(access.session.locale, "invd.no_access_description")}
            />
          </div>
        </OpsPage>
      ) : null}
      {result.kind === "unavailable" ? (
        <PortalWorkspaceUnavailable title={portalText(access.session.locale, "inv.title")} icon={<Receipt size={18}/>} locale={access.session.locale}/>
      ) : null}
    </PortalShell>
  );
}
