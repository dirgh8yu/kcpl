import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { evaluateFreightAutomation } from "../alerts/freight-automation.server";
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
    await evaluateFreightAutomation();
  } catch (error) {
    console.error("KCPL freight automation evaluation failed during Overview load", error);
  }

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

  return <OperationsShell {...shellProps}><V4OperationsOverview data={state.data} overview={state.overview}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#F6F6F3] p-6 text-[#101010] ${embedded ? "min-h-[calc(100vh-56px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[16px] border border-[#E2E2DD] bg-white p-8 shadow-[0_16px_48px_rgba(16,16,16,.06)] sm:p-10"><span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#DC143C]/[0.07] text-[#DC143C]"><ShieldCheck size={17}/></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#DC143C]">KCPL Operations</p><h1 className="mt-2 text-[28px] font-extrabold tracking-[-.035em]">{title}</h1><p className="mt-3 text-[13px] font-medium leading-6 text-[#60605B]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/enquiries" className="inline-flex h-10 items-center rounded-[9px] bg-[#DC143C] px-4 text-[12px] font-semibold text-white transition hover:bg-[#C41235]">Open Enquiries</Link><Link href="/" className="inline-flex h-10 items-center rounded-[9px] border border-[#DCDCD7] bg-white px-4 text-[12px] font-semibold transition hover:border-[#C7C7C1]">KCPL website</Link></div></section></main>;
}
