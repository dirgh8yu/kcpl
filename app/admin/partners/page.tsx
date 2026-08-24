import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { canEditPartnerNetwork, canViewPartnerFinance } from "./partner-policy";
import { Partner360Jump } from "./partner-360-jump";
import { PartnersWorkspace } from "./partners-workspace";
import { listPartnerDashboard } from "./partners.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partners & Vendors | KCPL Operations", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try { return { kind: "ready", staff: await getStaffContext(user) }; }
  catch (error) { console.error("Failed to resolve KCPL staff context for Partner Network", error); return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) }; }
}

async function loadDashboard(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try { const dashboard = await listPartnerDashboard(staff); return dashboard ? { kind: "ready" as const, dashboard } : { kind: "unavailable" as const }; }
  catch (error) { console.error("Failed to load KCPL partner network", error); return { kind: "error" as const }; }
}

export default async function PartnersPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="The partner network is available only to authorised KCPL staff."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate title="Partner network could not be loaded" detail="KCPL supplier and counterpart data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
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
  const result = await loadDashboard(staff);
  if (result.kind === "error") return <OperationsShell {...shellProps}><Gate title="Partner network could not be loaded" detail="KCPL supplier and counterpart data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate title="Partner network is unavailable" detail="The Firebase partner registry is not available for this deployment. Navigation and search remain available." embedded/></OperationsShell>;

  const dashboard = result.dashboard;
  const canEdit = canEditPartnerNetwork(staff.permissions);
  const canEditGlobal = canEdit && (staff.permissions.role === "management" || staff.can_access_all_branches);
  return <OperationsShell {...shellProps}><Partner360Jump partners={dashboard.partners.map((partner) => ({ id: partner.id, display_name: partner.display_name }))} canReconcile={staff.permissions.canManageFinance}/><PartnersWorkspace dashboard={dashboard} canEdit={canEdit} canEditGlobal={canEditGlobal} editableOwnerBranches={staff.branches} commercialVisible={staff.permissions.canViewCommercial} financialVisible={canViewPartnerFinance(staff.permissions)}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Network · Partners" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/partners", label: "Partners", primary: true }, { href: "/admin/carrier-integrations", label: "Carrier Integrations" }, { href: "/admin/edi", label: "EDI Gateway" }]}/>;
}
