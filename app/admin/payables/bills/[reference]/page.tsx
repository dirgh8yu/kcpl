import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { kcplStaffRoleLabels } from "../../../staff-permissions";
import { getStaffContext } from "../../../staff-directory.server";
import { V4WorkspaceGate } from "../../../v4-workspace-gate";
import { getPayable } from "../../payables.server";
import { PayableWorkspace } from "./payable-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supplier Bill | KCPL Accounts Payable", robots: { index: false, follow: false } };

export default async function PayableBillPage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Supplier bills are available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate embedded title="Accounts Payable is restricted" detail="Supplier bills are available to Management and Accounts roles only."/></OperationsShell>;

  const { reference } = await params;
  const result = await getPayable(reference, staff);
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Accounts Payable unavailable" detail="The Firestore payable ledger is unavailable for this deployment."/></OperationsShell>;
  if (result.kind === "missing") return <OperationsShell {...shellProps}><Gate embedded title="Supplier bill not found" detail="This payable reference does not exist."/></OperationsShell>;
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Outside your branch access" detail="This supplier bill belongs to a branch outside your staff profile."/></OperationsShell>;

  return <OperationsShell {...shellProps}><PayableWorkspace bill={result.bill} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance · Supplier Bill" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/payables", label: "Payables", primary: true }, { href: "/admin/freight-audit", label: "Freight Audit" }, { href: "/admin/finance", label: "Receivables" }]}/>;
}
