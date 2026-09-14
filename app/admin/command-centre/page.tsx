import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext, type KcplStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail } from "../staff-permissions";
import { OperationsShell } from "../operations-shell";
import { OpsPage, OpsPageHeader } from "../operations-ui";
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

type StaffState =
  | { kind: "ready"; staff: KcplStaffContext; shell: ShellState }
  | { kind: "restricted"; shell: ShellState }
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

async function OverviewData({ staff, isManagement }: { staff: KcplStaffContext; isManagement: boolean }) {
  try {
    const [data, overview] = await Promise.all([
      loadCommandCentre(staff),
      loadWorkflowOverview(staff),
    ]);
    if (!data) return <Gate title="Overview data is unavailable" detail="The Firebase operational data service is not available for this deployment." embedded />;
    return <V4OperationsOverview data={data} overview={overview} isManagement={isManagement}/>;
  } catch (error) {
    console.error("Failed to load KCPL Overview data", error);
    return <Gate title="Overview could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded />;
  }
}

function OverviewLoading() {
  return (
    <div className="overview-loading-region" aria-busy="true" aria-label="Loading Operations Overview">
      <OpsPage className="overview-loading-page">
        <OpsPageHeader
          eyebrow="Operations · Overview"
          title="Operations overview"
          description="Loading the current operational snapshot and desk summaries."
        >
          <div className="overview-loading-stats" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <span key={index}/>) }
          </div>
        </OpsPageHeader>
        <div className="ops-content ops-content-wide overview-loading-content" aria-hidden="true">
          <div className="overview-loading-toolbar"/>
          <div className="overview-loading-grid"><span/><span/></div>
          <div className="overview-loading-panel"/>
          <div className="overview-loading-grid"><span/><span/></div>
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
