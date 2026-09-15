import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { getStaffContext, type KcplStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail } from "../staff-permissions";
import { loadCommandCentre } from "./command-centre.server";
import type { CommandCentreData } from "./command-centre-data";
import { getLatestOperationalNote, type OperationalNote } from "./operational-notes.server";
import { getOverviewFinanceSnapshot, type OverviewFinanceSnapshot } from "./overview-finance.server";
import { OverviewShell } from "./overview-shell";
import { V4OperationsOverview } from "./v4-operations-overview";
import { loadWorkflowOverview, type WorkflowOverview } from "./workflow-overview.server";

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

type StaffState =
  | { kind: "ready"; staff: KcplStaffContext; shell: ShellState }
  | { kind: "restricted"; shell: ShellState }
  | { kind: "error"; shell: ShellState };

type OverviewState =
  | { kind: "ready"; data: CommandCentreData; workflow: WorkflowOverview; finance: OverviewFinanceSnapshot | null; note: OperationalNote | null }
  | { kind: "unavailable" }
  | { kind: "error" };

const emptyWorkflow: WorkflowOverview = {
  planning: null,
  tendering: null,
  pickup: null,
  documents: null,
  visibility: null,
  delivery: null,
  finance: null,
  critical_blockers: null,
  movements: [],
  recent_activity: [],
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

async function loadStaffState(user: StaffUser): Promise<StaffState> {
  let staff: KcplStaffContext;
  try {
    staff = await getStaffContext(user);
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Overview", error);
    return { kind: "error", shell: fallbackShellState(user) };
  }

  const shell: ShellState = {
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };

  if (!staff.permissions.canManageJobFile) return { kind: "restricted", shell };
  return { kind: "ready", staff, shell };
}

function scopedStaffContext(staff: KcplStaffContext, branch: "all" | KcplBranch) {
  if (branch === "all") return staff;
  return {
    ...staff,
    can_access_all_branches: false,
    branches: [branch],
    profile: {
      ...staff.profile,
      branch_scope: "selected" as const,
      branches: [branch],
    },
  } satisfies KcplStaffContext;
}

async function loadOverviewState(staff: KcplStaffContext): Promise<OverviewState> {
  try {
    const dataPromise = loadCommandCentre(staff, { includeDelivered: true });
    const workflowPromise = loadWorkflowOverview(staff).catch((error) => {
      console.error("Failed to load KCPL workflow snapshot for Overview", error);
      return emptyWorkflow;
    });
    const financePromise = getOverviewFinanceSnapshot(staff).catch((error) => {
      console.error("Failed to load KCPL finance snapshot for Overview", error);
      return null;
    });
    const notePromise = getLatestOperationalNote(staff).catch((error) => {
      console.error("Failed to load KCPL operational note for Overview", error);
      return null;
    });
    const [data, workflow, finance, note] = await Promise.all([dataPromise, workflowPromise, financePromise, notePromise]);
    if (!data) return { kind: "unavailable" };
    return { kind: "ready", data, workflow, finance, note };
  } catch (error) {
    console.error("Failed to load KCPL Overview data", error);
    return { kind: "error" };
  }
}

function roleLabel(role: KcplStaffContext["permissions"]["role"]) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default async function CommandCentrePage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Overview is available only to authorised KCPL staff." />;

  const staffState = await loadStaffState(access.user);
  if (staffState.kind === "restricted") return <Gate title="Overview is restricted" detail="Your current staff role does not include operational Job File access." />;
  if (staffState.kind === "error") return <Gate title="Overview could not be loaded" detail="KCPL staff permissions are temporarily unavailable." />;

  const query = await searchParams;
  const staff = staffState.staff;
  const accessibleBranches = staff.can_access_all_branches ? [...kcplBranches] : staff.branches;
  const requestedBranch = (query.branch ?? "").trim();
  const selectedBranch: "all" | KcplBranch = requestedBranch === "all" && staff.can_access_all_branches
    ? "all"
    : accessibleBranches.includes(requestedBranch as KcplBranch)
      ? requestedBranch as KcplBranch
      : accessibleBranches.includes("Kathmandu")
        ? "Kathmandu"
        : accessibleBranches[0] ?? "Kathmandu";
  const scopedStaff = scopedStaffContext(staff, selectedBranch);
  const overview = await loadOverviewState(scopedStaff);
  const userName = staff.profile.display_name || access.user.displayName || access.user.email;
  const capabilities = {
    canManageStaff: staffState.shell.canManageStaff,
    canManageFinance: staffState.shell.canManageFinance,
    canViewCommercial: staffState.shell.canViewCommercial,
    canManageJobFile: staffState.shell.canManageJobFile,
    isManagement: staffState.shell.isManagement,
  };

  return (
    <OverviewShell
      userName={userName}
      roleLabel={roleLabel(staff.permissions.role)}
      branches={accessibleBranches}
      selectedBranch={selectedBranch}
      canAccessAllBranches={staff.can_access_all_branches}
      capabilities={capabilities}
    >
      {overview.kind === "unavailable" ? <Gate title="Overview data is unavailable" detail="The Firebase operational data service is not available for this deployment." embedded /> : null}
      {overview.kind === "error" ? <Gate title="Overview could not be loaded" detail="KCPL operational data is temporarily unavailable. Search and notifications remain available while the data service recovers." embedded /> : null}
      {overview.kind === "ready" ? (
        <V4OperationsOverview
          data={overview.data}
          workflow={overview.workflow}
          finance={overview.finance}
          note={overview.note}
          userName={userName}
          selectedBranch={selectedBranch}
          branches={accessibleBranches}
          canViewCommercial={staff.permissions.canViewCommercial}
          canPostNotes={staff.permissions.canManageJobFile}
        />
      ) : null}
    </OverviewShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`kcpl-overview-gate font-[var(--font-inter)] ${embedded ? "min-h-[calc(100vh-64px)]" : "min-h-screen"}`}><section className="kcpl-overview-gate-card"><span className="kcpl-overview-gate-mark"><ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true"/></span><p className="kcpl-overview-gate-kicker">KCPL Operations</p><h1>{title}</h1><p>{detail}</p><div className="kcpl-overview-gate-actions"><Link href="/admin/enquiries">Open Enquiries</Link><Link href="/">KCPL website</Link></div></section></main>;
}
