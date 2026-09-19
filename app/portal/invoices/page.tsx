import { Receipt } from "lucide-react";
import { OpsEmptyState, OpsPage, OpsPageHeader } from "../../admin/operations-ui";
import { getPortalAccess } from "../portal-auth";
import { listPortalInvoices } from "../portal-data.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable, PortalWorkspaceUnavailable } from "../portal-frame";
import { PortalInvoicesWorkspace } from "./portal-invoices-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalInvoicesPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const result = await listPortalInvoices(access.session);
  return (
    <PortalShell
      customerName={access.session.customerName}
      accountEmail={access.session.email}
      capabilities={access.session.capabilities}
    >
      {result.kind === "ready"
        ? <PortalInvoicesWorkspace invoices={result.invoices} summary={result.summary}/>
        : null}
      {result.kind === "forbidden" ? (
        <OpsPage>
          <OpsPageHeader eyebrow="Kapileshwor Cargo" title="Invoices"/>
          <div className="ops-content">
            <OpsEmptyState
              kind="unavailable"
              icon={<Receipt size={18}/>}
              title="Account billing is not shared with this login"
              description="Your KCPL portal account can view shipments and documents. Ask your account owner or KCPL account manager if you also need invoice access."
            />
          </div>
        </OpsPage>
      ) : null}
      {result.kind === "unavailable" ? (
        <PortalWorkspaceUnavailable eyebrow="Kapileshwor Cargo" title="Invoices" icon={<Receipt size={18}/>}/>
      ) : null}
    </PortalShell>
  );
}
