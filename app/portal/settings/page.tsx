import { getPortalAccess } from "../portal-auth";
import { getPortalNotificationPreferences } from "../portal-accounts.server";
import { portalNotificationPreferences } from "../portal-notifications";
import { transactionalEmailConfigured } from "../../integrations/sendgrid-email.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable } from "../portal-frame";
import { PortalSettingsWorkspace } from "./portal-settings-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalSettingsPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const stored = await getPortalNotificationPreferences(access.session.email);
  return (
    <PortalShell
      customerName={access.session.customerName}
      accountEmail={access.session.email}
      capabilities={access.session.capabilities}
    >
      <PortalSettingsWorkspace
        email={access.session.email}
        customerName={access.session.customerName}
        role={access.session.role}
        initialPreferences={stored ?? portalNotificationPreferences(null)}
        emailConfigured={transactionalEmailConfigured()}
      />
    </PortalShell>
  );
}
