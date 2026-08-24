import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { canEditPartnerNetwork } from "../partner-policy";
import type { PartnerOwnerBranch } from "../partners-data";
import { NewPartnerWorkspace } from "./new-partner-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Partner | KCPL Operations", robots: { index: false, follow: false } };

export default async function NewPartnerPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Partner creation is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  const canEdit = canEditPartnerNetwork(staff.permissions);
  if (!canEdit) return <OperationsShell {...shellProps}><Gate embedded title="Partner editing is restricted" detail="Your current KCPL role has read-only Partner Network access."/></OperationsShell>;

  const canGlobal = staff.permissions.role === "management" || staff.can_access_all_branches;
  const ownerOptions: PartnerOwnerBranch[] = [...(canGlobal ? ["Global" as const] : []), ...staff.branches];
  if (!ownerOptions.length) return <OperationsShell {...shellProps}><Gate embedded title="No editable branch is assigned" detail="A KCPL branch assignment is required before you can create a Partner record."/></OperationsShell>;

  return <OperationsShell {...shellProps}><NewPartnerWorkspace ownerOptions={ownerOptions}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Network · New Partner" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/partners", label: "Partners", primary: true }, { href: "/admin/command-centre", label: "Operations Home" }]}/>;
}
