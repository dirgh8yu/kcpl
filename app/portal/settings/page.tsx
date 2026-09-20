import { getPortalAccess } from "../portal-auth";
import { getPortalNotificationPreferences, listPortalTeam } from "../portal-accounts.server";
import { portalNotificationPreferences } from "../portal-notifications";
import { transactionalEmailConfigured } from "../../integrations/sendgrid-email.server";
import { PortalLoginPage } from "../portal-login-page";
import { PortalShell } from "../portal-shell";
import { PortalUnavailable } from "../portal-frame";
import { PortalSettingsWorkspace } from "./portal-settings-workspace";
import { portalPushConfigured, portalPushPublicKey } from "../portal-push.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings · KCPL Customer Portal", robots: { index: false, follow: false } };

export default async function PortalSettingsPage() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return <PortalUnavailable/>;
  if (access.kind === "signed-out") return <PortalLoginPage/>;

  const [stored, team] = await Promise.all([
    getPortalNotificationPreferences(access.session.email),
    // Only an account owner manages logins, so only an owner is served the list.
    access.session.role === "owner" ? listPortalTeam(access.session.customerId) : Promise.resolve(null),
  ]);
  return (
    <PortalShell
      session={access.session}
    >
      <PortalSettingsWorkspace
        email={access.session.email}
        customerName={access.session.customerName}
        role={access.session.role}
        initialPreferences={stored ?? portalNotificationPreferences(null)}
        emailConfigured={transactionalEmailConfigured()}
        team={team}
        locale={access.session.locale}
        pushPublicKey={portalPushConfigured() ? portalPushPublicKey() : ""}
      />
    </PortalShell>
  );
}
