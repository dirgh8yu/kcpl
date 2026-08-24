import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail, type StaffCapabilities } from "../../staff-permissions";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { SupplierReconciliationWorkspace } from "./supplier-reconciliation-workspace";
import { listSupplierReconciliation } from "./supplier-reconciliation.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supplier Reconciliation | KCPL Finance", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try { return { kind: "ready", staff: await getStaffContext(user) }; }
  catch (error) { console.error("Failed to resolve KCPL staff context for Supplier Reconciliation", error); return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) }; }
}

async function loadReconciliation(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try { return await listSupplierReconciliation(staff); }
  catch (error) { console.error("Failed to load KCPL Supplier Reconciliation", error); return { kind: "error" as const }; }
}

export default async function SupplierReconciliationPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Supplier reconciliation is available only to authorised KCPL staff."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate title="Supplier reconciliation could not be loaded" detail="KCPL payable and partner data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
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
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate title="Supplier reconciliation is restricted" detail="Only Management and Accounts can relink legacy supplier bills to Partner records." embedded/></OperationsShell>;

  const loaded = await loadReconciliation(staff);
  if (loaded.kind === "forbidden") return <OperationsShell {...shellProps}><Gate title="Supplier reconciliation is restricted" detail="Your role does not have Accounts Payable authority." embedded/></OperationsShell>;
  if (loaded.kind === "unavailable" || loaded.kind === "error") return <OperationsShell {...shellProps}><Gate title={loaded.kind === "error" ? "Supplier reconciliation could not be loaded" : "Supplier reconciliation is unavailable"} detail="The Partner and Accounts Payable stores are temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  return <OperationsShell {...shellProps}><SupplierReconciliationWorkspace snapshot={loaded.snapshot} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance · Supplier Reconciliation" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/partners/reconciliation", label: "Reconciliation", primary: true }, { href: "/admin/payables", label: "Payables" }, { href: "/admin/partners", label: "Partners" }]}/>;
}
