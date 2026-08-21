import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { buildManagementAnalytics, resolveManagementRange } from "./management.server";
import { ManagementWorkspace } from "./management-workspace";
import { RuntimeReadinessPanel } from "./runtime-readiness-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Executive Dashboard | KCPL", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ManagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Executive analytics are available only to authorised KCPL management."/>;
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return <Gate title="Management access required." detail="Executive performance, profitability and company-wide financial analytics are restricted to the Management role."/>;

  const params = await searchParams;
  const range = resolveManagementRange(param(params.range), param(params.from), param(params.to));
  const analytics = await buildManagementAnalytics(range);
  if (!analytics) return <Gate title="Analytics are unavailable." detail="The Firebase reporting backend is unavailable for this deployment."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement
    >
      <ManagementWorkspace analytics={analytics}/>
      <RuntimeReadinessPanel/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Management Intelligence</p><h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Operations</Link><Link href="/admin/command-centre" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Operations Home</Link></div></section></main>;
}
