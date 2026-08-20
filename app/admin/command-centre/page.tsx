import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { loadCommandCentre } from "./command-centre.server";
import { CommandCentreWorkspace } from "./command-centre-workspace";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Operations Command Centre | KCPL",
  robots: { index: false, follow: false },
};

export default async function CommandCentrePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") {
    return <Gate title="Sign in to KCPL Operations." detail="The Operations Command Centre is available only to authorised KCPL staff." />;
  }

  try {
    const staff = await getStaffContext(access.user);
    if (!staff.permissions.canManageJobFile) {
      return <Gate title="Command Centre access is restricted." detail="Your staff role does not currently include operational Job File access." />;
    }
    const data = await loadCommandCentre(staff);
    if (!data) return <Gate title="Firestore is unavailable." detail="The operational dashboard backend is not available for this deployment." />;
    return <CommandCentreWorkspace data={data} roleLabel={kcplStaffRoleLabels[staff.permissions.role]} />;
  } catch (error) {
    console.error("Failed to load KCPL Operations Command Centre", error);
    return <Gate title="The Command Centre could not be loaded." detail="KCPL operational data is temporarily unavailable. No operations data was exposed." />;
  }
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Operations</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-black/60">{detail}</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/admin" className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">Back to Operations</Link><Link href="/" className="rounded-xl border border-black/10 px-5 py-3 text-sm font-black">Website</Link></div>
      </section>
    </main>
  );
}
