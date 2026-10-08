import "../plan-sell-premium.css";
import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
import { OpsInlineAlert, OpsPage, OpsPageHeader } from "../operations-ui";
import { GoogleRoadRoutePanel } from "../routes/google-road-route-panel";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { MarketEstimateWorkspace } from "./market-estimate-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market rates", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Market rates", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Use an authorised KCPL staff account to access commercial tools."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate title="Market rates didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
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

  const routesConfigured = Boolean(process.env.GOOGLE_MAPS_ROUTES_API_KEY?.trim());
  const placesConfigured = Boolean(process.env.GOOGLE_MAPS_PLACES_API_KEY?.trim());
  const emailConfigured = Boolean(process.env.SENDGRID_API_KEY?.trim() && process.env.KCPL_EMAIL_FROM?.trim());
  const setupNeeded = [
    ...(routesConfigured && placesConfigured ? [] : ["Road distances (Google)"]),
    ...(emailConfigured ? [] : ["Quote email"]),
  ];

  return (
    <OperationsShell {...shellProps}>
      <OpsPage>
        <OpsPageHeader
          title="Market rates"
          description="Market freight prices, exchange rates and road distances, for reference."
        />

        <div className="px-4 pb-8 pt-4 md:px-6">
          {/* A source that isn't set up says so, so its blank result can't pass
            * for "no data"; sources that work need no announcement. */}
          {setupNeeded.length ? <div className="mb-4"><OpsInlineAlert>{setupNeeded.join(" and ")} {setupNeeded.length === 1 ? "isn’t" : "aren’t"} set up yet, so {setupNeeded.length === 1 ? "it" : "they"} won’t return results here.</OpsInlineAlert></div> : null}

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
    eyebrow="Market rates"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[{ href: "/admin/enquiries", label: "Enquiries", primary: true }]}
  />;
}
