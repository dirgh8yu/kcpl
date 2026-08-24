import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { FinanceWorkspace } from "./finance-workspace";
import { listFinanceDashboard } from "./finance.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance & Accounts Receivable | KCPL", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try { return { kind: "ready", staff: await getStaffContext(user) }; }
  catch (error) { console.error("Failed to resolve KCPL staff context for Finance", error); return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) }; }
}

async function loadDashboard(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try { const dashboard = await listFinanceDashboard(staff); return dashboard ? { kind: "ready" as const, dashboard } : { kind: "unavailable" as const }; }
  catch (error) { console.error("Failed to load KCPL Finance dashboard", error); return { kind: "error" as const }; }
}

export default async function FinancePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Finance is available only to authorised KCPL staff."/>;
  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate title="Finance could not be loaded" detail="KCPL finance data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }
  const staff = staffResult.staff;
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate title="Finance access is restricted" detail="Accounts Receivable is available to Management and Accounts roles only." embedded/></OperationsShell>;
  const result = await loadDashboard(staff);
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate title={result.kind === "error" ? "Finance could not be loaded" : "Finance is unavailable"} detail="The Firestore finance backend is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;
  return <OperationsShell {...shellProps}><FinanceWorkspace dashboard={result.dashboard} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/><div className="ops-content pb-6"><ForexReferencePanel/></div></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance · Receivables" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }, { href: "/admin/payables", label: "Payables" }]}/>;
}
