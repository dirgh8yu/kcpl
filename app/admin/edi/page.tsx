import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { OpsPage } from "../operations-ui";
import { getStaffContext } from "../staff-directory.server";
import { listTmsTenders } from "../tenders/tms-tendering.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listEdiGatewayDashboard } from "./edi-gateway.server";
import { EdiWorkspace } from "./edi-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "EDI Gateway | KCPL Operations", robots: { index: false, follow: false } };

export default async function EdiGatewayPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL EDI Gateway is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shell = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shell}><Gate title="EDI access restricted" detail="Your role does not include shipment execution access." embedded/></OperationsShell>;

  let dashboard: Awaited<ReturnType<typeof listEdiGatewayDashboard>>;
  let tenders: Awaited<ReturnType<typeof listTmsTenders>>;
  try {
    [dashboard, tenders] = await Promise.all([listEdiGatewayDashboard(staff), listTmsTenders(staff)]);
  } catch (error) {
    console.error("Failed to load KCPL EDI Gateway", error);
    return <OperationsShell {...shell}><Gate title="EDI Gateway temporarily unavailable" detail="EDI transaction data could not be loaded. No tender or shipment records have been changed." embedded/></OperationsShell>;
  }
  if (dashboard.kind !== "ready" || tenders.kind !== "ready") return <OperationsShell {...shell}><Gate title="EDI Gateway unavailable" detail="Firebase EDI storage is unavailable for this deployment." embedded/></OperationsShell>;
  const eligible = tenders.tenders.filter((tender) => tender.status === "sent" && (tender.channel === "manual" || tender.channel === "edi_204"));
  return <OperationsShell {...shell}><OpsPage><EdiWorkspace initialRows={dashboard.rows} initialSummary={dashboard.summary} initialConfigured={dashboard.configured} initialEligibleTenders={eligible} canQueue204={staff.permissions.canEditCommercial}/></OpsPage></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Network · EDI Gateway" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/edi", label: "EDI Gateway", primary: true }, { href: "/admin/tenders", label: "Tender Desk" }, { href: "/admin/visibility", label: "Live Visibility" }, { href: "/admin/carrier-integrations", label: "Carrier Integrations" }]}/>;
}
