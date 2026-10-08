import Link from "next/link";
import type { ReactNode } from "react";
import { OpsEmptyState, OpsPage, OpsPageHeader } from "../admin/operations-ui";
import { portalText, type PortalLocale } from "./portal-i18n";
import { SignInLayout } from "../admin/sign-in-layout";

/** Shown when Firebase is not configured for this deployment at all, on the
 *  sign-in page's own layout: it stands where that page would. */
export function PortalUnavailable({
  title = "The customer portal is not available",
  detail = "KCPL's customer portal is not configured on this deployment. Please contact your KCPL account manager.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <SignInLayout
      title={title}
      lead={detail}
      help={<>To follow a single shipment, <Link href="/track">track it without signing in</Link>.</>}
    />
  );
}

/** Shown inside the shell when a workspace's data source is unreachable. */
export function PortalWorkspaceUnavailable({
  title,
  description,
  icon,
  locale = "en",
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** This one renders inside the shell, for a reader whose language is
   * already known. `PortalUnavailable` above deliberately stays English: it is
   * shown before anyone has signed in, so there is no reader to follow. */
  locale?: PortalLocale;
}) {
  return (
    <OpsPage>
      <OpsPageHeader title={title}/>
      <div className="ops-content">
        <OpsEmptyState
          kind="unavailable"
          icon={icon}
          title={portalText(locale, "common.unavailable_title")}
          description={description ?? portalText(locale, "common.unavailable_detail")}
        />
      </div>
    </OpsPage>
  );
}
