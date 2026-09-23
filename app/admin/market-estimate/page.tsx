import "../plan-sell-premium.css";
import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
import { OpsKpiRail, OpsPage, OpsPageHeader, OpsRailMetric } from "../operations-ui";
import { GoogleRoadRoutePanel } from "../routes/google-road-route-panel";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { MarketEstimateWorkspace } from "./market-estimate-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market Estimate | KCPL Operations", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Market Estimate", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Use an authorised KCPL staff account to access commercial tools."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate title="Market tools could not be loaded" detail="KCPL staff or integration data is temporarily unavailable. Navigation and search remain available while the service recovers." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Market intelligence tools are available to Management, Accounts and Commercial roles." embedded/></OperationsShell>;

  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];
  const routesConfigured = Boolean(process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim());
  const placesConfigured = Boolean(process.env.GOOGLE_MAPS_PLACES_API_KEY?.trim());
  const emailConfigured = Boolean(process.env.SENDGRID_API_KEY?.trim() && process.env.KCPL_EMAIL_FROM?.trim());

  return (
    <OperationsShell {...shellProps}>
      <OpsPage>
        <OpsPageHeader
          title="Market estimate"
          description="Freight benchmarks, NRB forex and road-route references. Advisory only; never overwrites a quote."
          meta={<span>{roleLabel} · live integration workspace</span>}
          actions={<>
            <Link href="/admin/rating" className="ops-button" data-variant="secondary" data-size="md">Rate Desk</Link>
            <Link href="/admin/pricing" className="ops-button" data-variant="secondary" data-size="md">Pricing Desk</Link>
            <Link href="/admin/consolidation" className="ops-button" data-variant="secondary" data-size="md">Load Planner</Link>
          </>}
        />

        <div className="px-4 pb-8 pt-4 md:px-6">
          {/* Source state stays visible so an unavailable provider cannot masquerade as a blank result. */}
          <OpsKpiRail label="Connected reference sources">
            <OpsRailMetric label="Freight benchmark" value="Available" tone="success" detail="Freightos" title="Freightos public estimate adapter"/>
            <OpsRailMetric label="NRB Forex" value="Available" tone="success" detail="Nepal Rastra Bank" title="Official Nepal Rastra Bank reference rates"/>
            <OpsRailMetric label="Google Routes + Places" value={routesConfigured && placesConfigured ? "Available" : "Check setup"} tone={routesConfigured && placesConfigured ? "success" : "warning"} detail={routesConfigured && placesConfigured ? "Configured" : undefined} title={routesConfigured && placesConfigured ? "Firebase secrets detected" : "API code available · check Firebase secrets"}/>
            <OpsRailMetric label="SendGrid quote email" value={emailConfigured ? "Available" : "Check setup"} tone={emailConfigured ? "success" : "warning"} detail={emailConfigured ? "Configured" : undefined} title={emailConfigured ? "Firebase email configuration detected" : "API code available · check Firebase secrets"}/>
          </OpsKpiRail>

          <MarketEstimateWorkspace/>
          <div className="plan-section"><ForexReferencePanel compact/></div>
          <div className="plan-section"><GoogleRoadRoutePanel initialOrigin="Kolkata, India" initialDestination="Kathmandu, Nepal" compact/></div>
        </div>
      </OpsPage>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Market Estimate"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin", label: "Enquiries", primary: true },
      { href: "/admin/rating", label: "Rate Desk" },
    ]}
  />;
}
