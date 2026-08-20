import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { buildManagementAnalytics, resolveManagementRange } from "./management.server";
import { ManagementWorkspace } from "./management-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Management Analytics | KCPL", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ManagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Management analytics are available only to authorised KCPL management."/>;
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return <Gate title="Management access required." detail="Company-wide performance, profitability and financial analytics are restricted to the Management role."/>;

  const params = await searchParams;
  const range = resolveManagementRange(param(params.range), param(params.from), param(params.to));
  const analytics = await buildManagementAnalytics(range);
  if (!analytics) return <Gate title="Analytics are unavailable." detail="The Firebase reporting backend is unavailable for this deployment."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={kcplStaffRoleLabels[staff.permissions.role]}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement
    >
      <ManagementWorkspace analytics={analytics}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Management</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/command-centre" className="ops-button ops-button-primary">Operations Home</Link><Link href="/admin" className="ops-button ops-button-secondary">Enquiry desk</Link></div></section></main>;
}
