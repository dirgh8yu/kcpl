import { redirect } from "next/navigation";
import { getAdminAccess } from "../admin-auth";
import { loginHref } from "../admin-entry";
import { evaluateFreightAutomation } from "../alerts/freight-automation.server";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { loadCommandCentre } from "./command-centre.server";
import { loadWorkflowOverview } from "./workflow-overview.server";
import { V4OperationsOverview } from "./v4-operations-overview";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Operations | KCPL",
  robots: { index: false, follow: false },
};

type StaffUser = { uid: string; displayName: string; email: string };
type ShellState = {
  canManageStaff: boolean;
  canManageFinance: boolean;
  canViewCommercial: boolean;
  canManageJobFile: boolean;
  isManagement: boolean;
};

type LoadState =
  | { kind: "authority_error" }
  | { kind: "restricted"; shell: ShellState }
  | { kind: "unavailable"; shell: ShellState }
  | { kind: "error"; shell: ShellState }
  | {
      kind: "ready";
      shell: ShellState;
      data: NonNullable<Awaited<ReturnType<typeof loadCommandCentre>>>;
      overview: Awaited<ReturnType<typeof loadWorkflowOverview>>;
    };

async function loadState(user: StaffUser): Promise<LoadState> {
  let staff;
  try {
    staff = await getStaffContext(user);
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Operations Home", error);
    return { kind: "authority_error" };
  }

  const shell: ShellState = {
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };

  if (!staff.permissions.canManageJobFile) return { kind: "restricted", shell };

  try {
    await evaluateFreightAutomation();
  } catch (error) {
    console.error("KCPL freight automation evaluation failed during Operations Home load", error);
  }

  try {
    const [data, overview] = await Promise.all([
      loadCommandCentre(staff),
      loadWorkflowOverview(staff),
    ]);
    if (!data) return { kind: "unavailable", shell };
    return { kind: "ready", data, overview, shell };
  } catch (error) {
    console.error("Failed to load KCPL Operations Home data", error);
    return { kind: "error", shell };
  }
}

export default async function CommandCentrePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") redirect(loginHref("/admin/command-centre"));

  const state = await loadState(access.user);
  if (state.kind === "authority_error") {
    return <V4WorkspaceGate
      eyebrow="KCPL Operations"
      title="Staff access could not be resolved"
      detail="KCPL could not verify your current staff role and branch scope. The workspace has failed closed rather than guessing your access."
      actions={[
        { href: "/api/admin/session?logout=1", label: "Sign in again", primary: true },
        { href: "/", label: "KCPL website" },
      ]}
    />;
  }

  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: state.shell.canManageStaff,
    canManageFinance: state.shell.canManageFinance,
    canViewCommercial: state.shell.canViewCommercial,
    canManageJobFile: state.shell.canManageJobFile,
    isManagement: state.shell.isManagement,
  };

  if (state.kind === "restricted") {
    return <OperationsShell {...shellProps}>
      <Gate title="Operations Home is restricted" detail="Your current staff role does not include operational Job File access." />
    </OperationsShell>;
  }
  if (state.kind === "unavailable") {
    return <OperationsShell {...shellProps}>
      <Gate title="Operations data is unavailable" detail="The Firebase operational data service is not available for this deployment." />
    </OperationsShell>;
  }
  if (state.kind === "error") {
    return <OperationsShell {...shellProps}>
      <Gate title="Operations Home could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available while the data service recovers." />
    </OperationsShell>;
  }

  return <OperationsShell {...shellProps}><V4OperationsOverview data={state.data} overview={state.overview}/></OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Operations"
    title={title}
    detail={detail}
    embedded
    actions={[
      { href: "/admin/shipments", label: "Open shipments", primary: true },
      { href: "/admin/notifications", label: "Notifications" },
    ]}
  />;
}
