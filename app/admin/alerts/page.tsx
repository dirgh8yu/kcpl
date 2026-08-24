import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listAutomationAlerts } from "./alert-engine.server";
import { AlertsWorkspace } from "./alerts-workspace";
import { evaluateFreightAutomation } from "./freight-automation.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks & Alerts | KCPL Operations", robots: { index: false, follow: false } };

type StaffUser = { uid: string; email: string; displayName: string };
type ShellState = {
  canManageStaff: boolean;
  canManageFinance: boolean;
  canViewCommercial: boolean;
  canManageJobFile: boolean;
  isManagement: boolean;
};

type LoadResult =
  | {
      kind: "ready";
      roleLabel: string;
      alerts: NonNullable<Awaited<ReturnType<typeof listAutomationAlerts>>>;
      shell: ShellState;
    }
  | { kind: "unavailable"; shell: ShellState }
  | { kind: "error"; shell: ShellState };

function fallbackShellState(user: StaffUser): ShellState {
  const permissions = staffCapabilitiesForEmail(user.email);
  return {
    canManageStaff: permissions.canManageStaff,
    canManageFinance: permissions.canManageFinance,
    canViewCommercial: permissions.canViewCommercial,
    canManageJobFile: permissions.canManageJobFile,
    isManagement: permissions.role === "management",
  };
}

async function loadPage(user: StaffUser): Promise<LoadResult> {
  let staff;
  try {
    staff = await getStaffContext(user);
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Tasks & Alerts", error);
    return { kind: "error", shell: fallbackShellState(user) };
  }

  const shell: ShellState = {
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };

  try {
    await evaluateFreightAutomation();
  } catch (error) {
    console.error("KCPL freight automation evaluation failed during alerts load", error);
  }

  try {
    const alerts = await listAutomationAlerts(staff, user.email, true);
    if (!alerts) return { kind: "unavailable", shell };
    return {
      kind: "ready",
      roleLabel: kcplStaffRoleLabels[staff.permissions.role],
      alerts,
      shell,
    };
  } catch (error) {
    console.error("Failed to load KCPL automation alerts", error);
    return { kind: "error", shell };
  }
}

export default async function AlertsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Tasks and alerts are available only to authorised KCPL staff."/>;

  const result = await loadPage(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: result.shell.canManageStaff,
    canManageFinance: result.shell.canManageFinance,
    canViewCommercial: result.shell.canViewCommercial,
    canManageJobFile: result.shell.canManageJobFile,
    isManagement: result.shell.isManagement,
  };

  if (result.kind === "unavailable") {
    return <OperationsShell {...shellProps}><Gate title="Alert storage unavailable" detail="Firestore is not available for the alerts workspace in this deployment. Navigation and search remain available." embedded/></OperationsShell>;
  }
  if (result.kind === "error") {
    return <OperationsShell {...shellProps}><Gate title="Tasks & alerts could not be loaded" detail="KCPL operational alert data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  return (
    <OperationsShell {...shellProps}>
      <AlertsWorkspace initialAlerts={result.alerts} roleLabel={result.roleLabel}/>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Attention Desk"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/command-centre", label: "Operations Overview", primary: true },
      { href: "/admin", label: "Enquiries" },
    ]}
  />;
}
