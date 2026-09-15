import Link from "next/link";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import type { QuoteSummary } from "../admin-data";
import { getStaffContext, type KcplStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail } from "../staff-permissions";
import { OperationsShell } from "../operations-shell";
import { OpsPage } from "../operations-ui";
import { loadCommandCentre } from "./command-centre.server";
import type { CommandCentreData } from "./command-centre-data";
import { V4OperationsOverview } from "./v4-operations-overview";
import type { FinanceOverviewSummary } from "../finance/finance-data";
import { getFinanceOverviewSummary } from "../finance/finance.server";

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
  | { kind: "ready"; data: CommandCentreData; enquiries: QuoteSummary[] | null; finance: FinanceOverviewSummary | null }
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
    const dataPromise = loadCommandCentre(staff);
    const enquiriesPromise = import("../admin-data.server")
      .then(({ listQuoteSummaries }) => listQuoteSummaries(staff))
      .catch((error) => {
        console.error("Failed to load KCPL enquiry snapshot for Overview", error);
        return null;
      });
    const financePromise = getFinanceOverviewSummary(staff).catch((error) => {
      console.error("Failed to load KCPL finance snapshot for Overview", error);
      return null;
    });
    const [data, enquiries, finance] = await Promise.all([dataPromise, enquiriesPromise, financePromise]);
    if (!data) return { kind: "unavailable" };
    return { kind: "ready", data, enquiries, finance };
  } catch (error) {
    console.error("Failed to load KCPL Overview data", error);
    return { kind: "error" };
  }
}

async function OverviewData({ staff }: { staff: KcplStaffContext }) {
  const state = await loadOverviewState(staff);
  if (state.kind === "unavailable") return <Gate title="Overview data is unavailable" detail="The Firebase operational data service is not available for this deployment." embedded />;
  if (state.kind === "error") return <Gate title="Overview could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded />;
  return <V4OperationsOverview data={state.data} enquiries={state.enquiries} finance={state.finance}/>;
}

function OverviewLoading() {
  return (
    <div className="overview-loading-region" aria-busy="true" aria-label="Loading Operations Overview">
      <OpsPage className="overview-loading-page">
        <div className="px-4 py-5 md:px-6 md:py-6" aria-hidden="true">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0"><div className="h-8 w-32 rounded-md bg-[var(--admin-surface-muted)]"/><div className="mt-2 h-5 w-72 max-w-full rounded-md bg-[var(--admin-surface-muted)]"/></div>
            <div className="flex gap-2"><span className="h-10 w-10 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface)]"/><span className="h-10 w-36 rounded-md bg-[var(--admin-crimson)] opacity-20"/></div>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-line)] bg-[var(--admin-line)] md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <span key={index} className="h-24 bg-[var(--admin-surface)]"/>)}</div>
          <div className="grid gap-4 xl:grid-cols-3"><div className="h-80 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-surface)] xl:col-span-2"/><div className="h-80 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-surface)]"/></div>
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
        <OverviewData staff={state.staff}/>
      </Suspense>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`kcpl-overview-gate font-[var(--font-inter)] ${embedded ? "min-h-[calc(100vh-64px)]" : "min-h-screen"}`}><section className="kcpl-overview-gate-card"><span className="kcpl-overview-gate-mark"><ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true"/></span><p className="kcpl-overview-gate-kicker">KCPL Operations</p><h1>{title}</h1><p>{detail}</p><div className="kcpl-overview-gate-actions"><Link href="/admin/enquiries">Open Enquiries</Link><Link href="/">KCPL website</Link></div></section></main>;
}
