import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext, listStaffProfiles } from "../staff-directory.server";
import { OperationsShell } from "../operations-shell";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff & Branches | KCPL Operations", robots: { index: false, follow: false } };

export default async function StaffPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Staff management is available only inside KCPL Operations."/>;
  const context = await getStaffContext(access.user);
  if (!context.permissions.canManageStaff) return <Gate title="Management access required" detail="Only KCPL Management can change staff roles and branch access."/>;
  const profiles = await listStaffProfiles();
  if (profiles === null) return <Gate title="Staff directory unavailable" detail="Firestore could not load the KCPL staff directory."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={kcplStaffRoleLabels[context.permissions.role]}
      canManageStaff
      canManageFinance={context.permissions.canManageFinance}
      isManagement={context.permissions.role === "management"}
    >
      <StaffManager initialProfiles={profiles}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Administration</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/command-centre" className="ops-button ops-button-primary">Operations Home</Link><Link href="/admin" className="ops-button ops-button-secondary">Enquiry desk</Link></div></section></main>;
}
