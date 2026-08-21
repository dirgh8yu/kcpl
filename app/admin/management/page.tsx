import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { buildManagementAnalytics, resolveManagementRange } from "./management.server";
import { ManagementWorkspace } from "./management-workspace";
import { RuntimeReadinessPanel } from "./runtime-readiness-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Executive Dashboard | KCPL", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;
type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Management", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

async function loadAnalytics(range: ReturnType<typeof resolveManagementRange>) {
  try {
    const analytics = await buildManagementAnalytics(range);
    return analytics ? { kind: "ready" as const, analytics } : { kind: "unavailable" as const };
  } catch (error) {
    console.error("Failed to load KCPL Management analytics", error);
    return { kind: "error" as const };
  }
}

export default async function ManagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Executive analytics are available only to authorised KCPL management."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} isManagement={permissions.role === "management"}><Gate title="Management analytics could not be loaded." detail="KCPL reporting data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (staff.permissions.role !== "management") return <OperationsShell {...shellProps}><Gate title="Management access required." detail="Executive performance, profitability and company-wide financial analytics are restricted to the Management role." embedded/></OperationsShell>;

  const params = await searchParams;
  const range = resolveManagementRange(param(params.range), param(params.from), param(params.to));
  const result = await loadAnalytics(range);
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate title={result.kind === "error" ? "Management analytics could not be loaded." : "Analytics are unavailable."} detail="The Firebase reporting backend is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  return (
    <OperationsShell {...shellProps}>
      <ManagementWorkspace analytics={result.analytics}/>
      <RuntimeReadinessPanel/>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f5f6f7] p-6 text-[#10263f] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Management Intelligence</p><h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Operations</Link><Link href="/admin/command-centre" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Operations Home</Link></div></section></main>;
}
