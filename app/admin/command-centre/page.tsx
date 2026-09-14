import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext, type KcplStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail } from "../staff-permissions";
import { OperationsShell } from "../operations-shell";
import { OpsEmptyState, OpsPage, OpsPageHeader, OpsSurface } from "../operations-ui";
import { loadCommandCentre } from "./command-centre.server";
import type { CommandCentreData } from "./command-centre-data";
import { loadWorkflowOverview, type WorkflowOverview } from "./workflow-overview.server";
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

type StaffState =
  | { kind: "ready"; staff: KcplStaffContext; shell: ShellState }
  | { kind: "restricted"; shell: ShellState }
  | { kind: "error"; shell: ShellState };

type OverviewState =
  | { kind: "ready"; data: CommandCentreData; overview: WorkflowOverview }
  | { kind: "unavailable" }
  | { kind: "error" };

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

async function loadOverviewState(staff: KcplStaffContext): Promise<OverviewState> {
  try {
    const [data, overview] = await Promise.all([
      loadCommandCentre(staff),
      loadWorkflowOverview(staff),
    ]);
    if (!data) return { kind: "unavailable" };
    return { kind: "ready", data, overview };
  } catch (error) {
    console.error("Failed to load KCPL Overview data", error);
    return { kind: "error" };
  }
}

async function OverviewData({ staff, isManagement }: { staff: KcplStaffContext; isManagement: boolean }) {
  const state = await loadOverviewState(staff);
  if (state.kind === "unavailable") return <Gate title="Overview data is unavailable" detail="The Firebase operational data service is not available for this deployment." embedded />;
  if (state.kind === "error") return <Gate title="Overview could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded />;
  return <V4OperationsOverview data={state.data} overview={state.overview} isManagement={isManagement}/>;
}

function OverviewLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Operations Overview">
      <OpsPage>
        <OpsPageHeader
          eyebrow="Operations · Overview"
          title="Operations overview"
          description="Loading the current operational snapshot and desk summaries."
        />
        <div className="ops-content ops-content-wide">
          <OpsSurface>
            <OpsEmptyState compact title="Loading operational snapshot" description="Current freight risk, commitments and workload are being prepared."/>
          </OpsSurface>
        </div>
      </OpsPage>
    </div>
  );
}

export default async function CommandCentrePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Overview is available only to authorised KCPL staff." />;

  const state = await loadStaffState(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: state.shell.canManageStaff,
    canManageFinance: state.shell.canManageFinance,
    canViewCommercial: state.shell.canViewCommercial,
    canManageJobFile: state.shell.canManageJobFile,
    isManagement: state.shell.isManagement,
  };

  if (state.kind === "restricted") return <OperationsShell {...shellProps}><Gate title="Overview is restricted" detail="Your current staff role does not include operational Job File access." embedded /></OperationsShell>;
  if (state.kind === "error") return <OperationsShell {...shellProps}><Gate title="Overview could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded /></OperationsShell>;

  return (
    <OperationsShell {...shellProps}>
      <Suspense fallback={<OverviewLoading/>}>
        <OverviewData staff={state.staff} isManagement={state.shell.isManagement}/>
      </Suspense>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`kcpl-overview-gate ${embedded ? "min-h-[calc(100vh-64px)]" : "min-h-screen"}`}><section className="kcpl-overview-gate-card"><span className="kcpl-overview-gate-mark"><ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true"/></span><p className="kcpl-overview-gate-kicker">KCPL Operations</p><h1>{title}</h1><p>{detail}</p><div className="kcpl-overview-gate-actions"><Link href="/admin/enquiries">Open Enquiries</Link><Link href="/">KCPL website</Link></div></section></main>;
}
