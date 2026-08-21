import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { listPaperArchive } from "./archive.server";
import { PaperArchiveWorkspace } from "./archive-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paper Archive | KCPL Operations", robots: { index: false, follow: false } };

export default async function PaperArchivePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL paper archive is available only to authorised Management staff."/>;
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return <Gate title="Management access required" detail="Historical paper files can contain operational and financial records, so Stage 4B is restricted to Management."/>;

  const dashboard = await listPaperArchive().catch((error) => {
    console.error("Failed to preload KCPL paper archive", error);
    return null;
  });

  return <OperationsShell
    userName={access.user.displayName}
    canManageStaff={staff.permissions.canManageStaff}
    canManageFinance={staff.permissions.canManageFinance}
    isManagement
  >
    <PaperArchiveWorkspace initialDashboard={dashboard}/>
  </OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Paper Archive</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/migration" className="ops-button" data-variant="primary" data-size="md">Migration Hub</Link><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations Home</Link></div></section></main>;
}
