import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext, listStaffProfiles } from "../staff-directory.server";
import { OperationsShell } from "../operations-shell";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff | KCPL Operations", robots: { index: false, follow: false } };

export default async function StaffPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Staff management is available only inside KCPL Operations."/>;
  const context = await getStaffContext(access.user);
  if (!context.permissions.canManageStaff) return <Gate title="Management access required" detail="Only KCPL Management can change staff roles and branch access."/>;
  const profiles = await listStaffProfiles();
  if (profiles === null) return <Gate title="Staff directory unavailable" detail="Firestore could not load the KCPL staff directory."/>;
  return <OperationsShell userName={access.user.displayName} canManageStaff><StaffManager initialProfiles={profiles}/></OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Staff</p><h1 className="mt-3 text-2xl font-bold">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Operations</Link><Link href="/admin/crm" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Customers</Link></div></section></main>;
}
