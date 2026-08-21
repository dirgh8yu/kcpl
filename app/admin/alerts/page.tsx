import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail } from "../staff-permissions";
import { listAutomationAlerts } from "./alert-engine.server";
import { evaluateFreightAutomation } from "./freight-automation.server";
import { AlertsWorkspace } from "./alerts-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks & Alerts | KCPL Operations", robots: { index: false, follow: false } };

type StaffUser = { uid: string; email: string; displayName: string };
type ShellState = {
  canManageStaff: boolean;
  canManageFinance: boolean;
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
    isManagement: staff.permissions.role === "management",
  };

  // Automation evaluation is useful background work, but a transient failure
  // must never take the operator out of the KCPL navigation shell.
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
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Tasks and alerts are available only to authorised KCPL staff." />;

  const result = await loadPage(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: result.shell.canManageStaff,
    canManageFinance: result.shell.canManageFinance,
    isManagement: result.shell.isManagement,
  };

  if (result.kind === "unavailable") {
    return <OperationsShell {...shellProps}><Gate title="Alert storage unavailable" detail="Firestore is not available for the alerts workspace in this deployment. Navigation and search remain available." embedded /></OperationsShell>;
  }
  if (result.kind === "error") {
    return <OperationsShell {...shellProps}><Gate title="Tasks & alerts could not be loaded" detail="KCPL operational alert data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded /></OperationsShell>;
  }

  return (
    <OperationsShell {...shellProps}>
      <AlertsWorkspace initialAlerts={result.alerts} roleLabel={result.roleLabel} />
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#332d29] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Attention Desk</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="primary" data-size="md">Operations Home</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Enquiries</Link></div></section></main>;
}
