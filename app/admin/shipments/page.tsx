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
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate title="Shipment access restricted" detail="Your KCPL staff role does not currently include Digital Job File access." embedded/></OperationsShell>;

  let data;
  try {
    data = await loadCommandCentre(staff);
  } catch (error) {
    console.error("Failed to load KCPL shipment queue", error);
    return <OperationsShell {...shellProps}><Gate title="Shipments could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available and no shipment records have been changed." embedded/></OperationsShell>;
  }

  if (!data) return <OperationsShell {...shellProps}><Gate title="Shipment backend unavailable" detail="Firestore is not available for this deployment. Navigation and search remain available." embedded/></OperationsShell>;

  return <OperationsShell {...shellProps}><ShipmentsWorkspace data={data} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return (
    <main className={`grid place-items-center bg-[#F6F6F3] p-6 text-[#101010] ${embedded ? "min-h-[calc(100vh-64px)]" : "min-h-screen"}`}>
      <section className="w-full max-w-xl border-y border-[#101010] py-8">
        <p className="text-[10px] uppercase tracking-[0.11em] text-[#DC143C]">KCPL Shipments</p>
        <h1 className="mt-3 text-[32px] font-normal tracking-[-.04em]">{title}</h1>
        <p className="mt-4 text-[14px] leading-6 text-[#5B5B57]">{detail}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/admin" className="inline-flex min-h-11 items-center border border-[#DC143C] bg-[#DC143C] px-5 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032]">Operations</Link>
          <Link href="/" className="inline-flex min-h-11 items-center border border-[#A5A5A0] px-5 text-[12px] font-medium text-[#101010] hover:border-[#101010] hover:bg-[#EEEEE8]">KCPL website</Link>
        </div>
      </section>
    </main>
  );
}
