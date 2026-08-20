import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { loadCommandCentre } from "../command-centre/command-centre.server";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { OperationsShell } from "../operations-shell";
import { ShipmentsWorkspace } from "./shipments-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipments | KCPL Operations", robots: { index: false, follow: false } };

export default async function ShipmentsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The shipment queue is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return <Gate title="Shipment access restricted" detail="Your staff role does not currently include Digital Job File access."/>;

  let data;
  try {
    data = await loadCommandCentre(staff);
  } catch (error) {
    console.error("Failed to load KCPL shipment queue", error);
    return <Gate title="Shipments could not be loaded" detail="KCPL operational data is temporarily unavailable."/>;
  }

  if (!data) return <Gate title="Shipment backend unavailable" detail="Firestore is not available for this deployment."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <ShipmentsWorkspace data={data} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Shipments</p><h1 className="mt-3 text-2xl font-bold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Operations</Link><Link href="/" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Website</Link></div></section></main>;
}
