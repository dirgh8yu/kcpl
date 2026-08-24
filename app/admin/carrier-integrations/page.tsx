import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { OpsPage } from "../operations-ui";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listCarrierIntegrationDashboard } from "./carrier-integrations.server";
import { CarrierIntegrationsWorkspace } from "./carrier-integrations-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carrier Integrations | KCPL Operations", robots: { index: false, follow: false } };

export default async function CarrierIntegrationsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Carrier integrations are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shell = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shell}><Gate title="Carrier integration access restricted" detail="Your role does not include shipment execution access." embedded/></OperationsShell>;

  let result: Awaited<ReturnType<typeof listCarrierIntegrationDashboard>> | null = null;
  try { result = await listCarrierIntegrationDashboard(staff); }
  catch (error) { console.error("Failed to load carrier integration workspace", error); }

  if (!result) return <OperationsShell {...shell}><Gate title="Carrier integrations temporarily unavailable" detail="Provider status could not be loaded. Navigation remains available and no shipment records have been changed." embedded/></OperationsShell>;
  if (result.kind !== "ready") return <OperationsShell {...shell}><Gate title="Carrier integrations unavailable" detail="Firebase carrier integration storage is not available for this deployment." embedded/></OperationsShell>;
  return <OperationsShell {...shell}><OpsPage><CarrierIntegrationsWorkspace initialProviders={result.providers} initialRows={result.rows} initialSummary={result.summary} canViewCommercial={staff.permissions.canViewCommercial}/></OpsPage></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Network · Carrier Integrations" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/carrier-integrations", label: "Carrier Integrations", primary: true }, { href: "/admin/visibility", label: "Live Visibility" }, { href: "/admin/partners", label: "Partners" }, { href: "/admin/edi", label: "EDI Gateway" }]}/>;
}
