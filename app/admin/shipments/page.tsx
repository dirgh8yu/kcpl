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
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The shipment register is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return <Gate title="Shipment access restricted" detail="Your KCPL staff role does not currently include Digital Job File access."/>;

  let data;
  try {
    data = await loadCommandCentre(staff);
  } catch (error) {
    console.error("Failed to load KCPL shipment queue", error);
    return <Gate title="Shipments could not be loaded" detail="KCPL operational data is temporarily unavailable. No shipment records have been changed."/>;
  }

  if (!data) return <Gate title="Shipment backend unavailable" detail="Firestore is not available for this deployment."/>;

  return <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
    <ShipmentsWorkspace data={data} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/>
  </OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#514840]"><section className="w-full max-w-xl rounded-[15px] border border-[#e5ddd6] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Shipments</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin" className="ops-button" data-variant="primary" data-size="md">Operations</Link><Link href="/" className="ops-button" data-variant="secondary" data-size="md">KCPL website</Link></div></section></main>;
}
