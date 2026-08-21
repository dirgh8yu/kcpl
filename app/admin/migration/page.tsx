import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listMigrationBatches } from "./migration-batches.server";
import { MigrationWorkspace } from "./migration-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Migration Hub | KCPL Operations", robots: { index: false, follow: false } };

export default async function MigrationPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Migration Hub is available only to authorised Management staff."/>;
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return <Gate title="Management access required" detail="Bulk migration can create company master data, so this workspace is restricted to the Management role."/>;
  const batchDashboard = await listMigrationBatches().catch((error) => {
    console.error("Failed to preload KCPL migration batch history", error);
    return null;
  });

  return <OperationsShell
    userName={access.user.displayName}
    canManageStaff={staff.permissions.canManageStaff}
    canManageFinance={staff.permissions.canManageFinance}
    isManagement
  >
    <MigrationWorkspace initialBatchDashboard={batchDashboard}/>
  </OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Migration Hub</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="primary" data-size="md">Operations Home</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Enquiries</Link></div></section></main>;
}
