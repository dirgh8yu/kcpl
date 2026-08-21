import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { evaluateFreightAutomation } from "../alerts/freight-automation.server";
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
    await evaluateFreightAutomation();
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
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Operations Home is available only to authorised KCPL staff." />;

  const state = await loadState(access.user);
  if (state.kind === "restricted") return <Gate title="Operations Home is restricted" detail="Your current staff role does not include operational Job File access." />;
  if (state.kind === "unavailable") return <Gate title="Operations data is unavailable" detail="The Firebase operational data service is not available for this deployment." />;
  if (state.kind === "error") return <Gate title="Operations Home could not be loaded" detail="KCPL operational data is temporarily unavailable. No operational records were exposed." />;

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
    <main className="grid min-h-screen place-items-center bg-[#f3f1ee] p-6 text-[#26221f]">
      <section className="w-full max-w-xl rounded-[16px] border border-[#ddd8d2] bg-white p-8 shadow-[0_12px_36px_rgba(54,43,34,.06)] sm:p-10">
        <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#fbebe6] text-[#b45c47]"><ShieldCheck size={17}/></span>
        <p className="mt-5 text-[10px] font-bold text-[#8f8179]">KCPL Operations</p>
        <h1 className="mt-2 text-[28px] font-[730] leading-tight tracking-[-.04em] text-[#26221f]">{title}</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#736d67]">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="ops-button" data-variant="primary" data-size="md">Open Enquiries</Link><Link href="/" className="ops-button" data-variant="secondary" data-size="md">KCPL website</Link></div>
      </section>
    </main>
  );
}