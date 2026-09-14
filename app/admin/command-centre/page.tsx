import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail } from "../staff-permissions";
import { OperationsShell } from "../operations-shell";
import { loadCommandCentre } from "./command-centre.server";
import { loadWorkflowOverview } from "./workflow-overview.server";
import { V4OperationsOverview } from "./v4-operations-overview";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Overview | KCPL Operations",
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

async function loadState(user: StaffUser) {
  let staff;
  try {
    staff = await getStaffContext(user);
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Overview", error);
    return { kind: "error" as const, shell: fallbackShellState(user) };
  }

  const shell: ShellState = {
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };

  if (!staff.permissions.canManageJobFile) return { kind: "restricted" as const, shell };


  try {
    const [data, overview] = await Promise.all([
      loadCommandCentre(staff),
      loadWorkflowOverview(staff),
    ]);
    if (!data) return { kind: "unavailable" as const, shell };
    return { kind: "ready" as const, data, overview, shell };
  } catch (error) {
    console.error("Failed to load KCPL Overview data", error);
    return { kind: "error" as const, shell };
  }
}

export default async function CommandCentrePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Overview is available only to authorised KCPL staff." />;

  const state = await loadState(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: state.shell.canManageStaff,
    canManageFinance: state.shell.canManageFinance,
    canViewCommercial: state.shell.canViewCommercial,
    canManageJobFile: state.shell.canManageJobFile,
    isManagement: state.shell.isManagement,
  };

  if (state.kind === "restricted") return <OperationsShell {...shellProps}><Gate title="Overview is restricted" detail="Your current staff role does not include operational Job File access." embedded /></OperationsShell>;
  if (state.kind === "unavailable") return <OperationsShell {...shellProps}><Gate title="Overview data is unavailable" detail="The Firebase operational data service is not available for this deployment." embedded /></OperationsShell>;
  if (state.kind === "error") return <OperationsShell {...shellProps}><Gate title="Overview could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded /></OperationsShell>;

  return <OperationsShell {...shellProps}><V4OperationsOverview data={state.data} overview={state.overview} isManagement={state.shell.isManagement}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`kcpl-overview-gate ${embedded ? "min-h-[calc(100vh-64px)]" : "min-h-screen"}`}><section className="kcpl-overview-gate-card"><span className="kcpl-overview-gate-mark"><ShieldCheck size={16}/></span><p className="kcpl-overview-gate-kicker">KCPL Operations</p><h1>{title}</h1><p>{detail}</p><div className="kcpl-overview-gate-actions"><Link href="/admin/enquiries">Open Enquiries</Link><Link href="/">KCPL website</Link></div></section></main>;
}
