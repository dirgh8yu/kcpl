import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { OperationsShell } from "../operations-shell";
import { loadCommandCentre } from "./command-centre.server";
import { CommandCentreWorkspace } from "./command-centre-workspace";
import { RoleHomeDefaults } from "./role-home-defaults";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Operations Home | KCPL",
  robots: { index: false, follow: false },
};

type StaffUser = { uid: string; displayName: string; email: string };

async function loadState(user: StaffUser) {
  try {
    const staff = await getStaffContext(user);
    if (!staff.permissions.canManageJobFile) return { kind: "restricted" as const };
    const data = await loadCommandCentre(staff);
    if (!data) return { kind: "unavailable" as const };
    return {
      kind: "ready" as const,
      data,
      role: staff.permissions.role,
      roleLabel: kcplStaffRoleLabels[staff.permissions.role],
      canManageStaff: staff.permissions.canManageStaff,
      canManageFinance: staff.permissions.canManageFinance,
      isManagement: staff.permissions.role === "management",
    };
  } catch (error) {
    console.error("Failed to load KCPL Operations Home", error);
    return { kind: "error" as const };
  }
}

export default async function CommandCentrePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Operations Home is available only to authorised KCPL staff." />;

  const state = await loadState(access.user);
  if (state.kind === "restricted") return <Gate title="Operations Home access is restricted." detail="Your staff role does not currently include operational Job File access." />;
  if (state.kind === "unavailable") return <Gate title="Firestore is unavailable." detail="The operational dashboard backend is not available for this deployment." />;
  if (state.kind === "error") return <Gate title="Operations Home could not be loaded." detail="KCPL operational data is temporarily unavailable. No operations data was exposed." />;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={state.canManageStaff}
      canManageFinance={state.canManageFinance}
      isManagement={state.isManagement}
    >
      <RoleHomeDefaults role={state.role}/>
      <CommandCentreWorkspace data={state.data} roleLabel={state.roleLabel}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]">
      <section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8 sm:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Operations</p>
        <h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Back to Operations</Link><Link href="/" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Website</Link></div>
      </section>
    </main>
  );
}
