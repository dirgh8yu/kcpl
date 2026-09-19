import Link from "next/link";
import type { ReactNode } from "react";
import { OpsEmptyState, OpsPage, OpsPageHeader } from "../admin/operations-ui";

/** Shown when Firebase is not configured for this deployment at all. */
export function PortalUnavailable({
  title = "The customer portal is not available",
  detail = "KCPL's customer portal is not configured on this deployment. Please contact your KCPL account manager.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <main className="kcpl-admin-shell portal-login">
      <div className="kcpl-admin-content portal-login-content">
        <section className="portal-login-card">
          <div className="portal-login-head">
            <div>
              <p className="portal-login-eyebrow">Kapileshwor Cargo</p>
              <h1>{title}</h1>
            </div>
          </div>
          <p className="portal-login-intro">{detail}</p>
          <div className="portal-login-footnote">
            <Link href="/">Public website</Link>
            <Link href="/tracking">Track a shipment</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Shown inside the shell when a workspace's data source is unreachable. */
export function PortalWorkspaceUnavailable({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <OpsPage>
      <OpsPageHeader eyebrow={eyebrow} title={title}/>
      <div className="ops-content">
        <OpsEmptyState
          kind="unavailable"
          icon={icon}
          title="This information is temporarily unavailable"
          description={description ?? "KCPL's systems could not be reached. Please try again in a moment, or contact your account manager."}
        />
      </div>
    </OpsPage>
  );
}
