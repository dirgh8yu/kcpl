import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext, listStaffProfiles } from "../staff-directory.server";
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
  return <StaffManager initialProfiles={profiles}/>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Staff</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Operations</Link><Link href="/admin/crm" className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">CRM</Link></div></section></main>;
}
