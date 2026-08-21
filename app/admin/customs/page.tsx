import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { evaluateFreightAutomation } from "../alerts/freight-automation.server";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listCustomsDeskRows } from "./customs-data.server";
import { CustomsWorkspace } from "./customs-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customs Desk | KCPL Operations", robots: { index: false, follow: false } };

export default async function CustomsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The Customs Desk is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  try {
    await evaluateFreightAutomation();
  } catch (error) {
    console.error("KCPL freight automation refresh failed while loading Customs Desk", error);
  }
  const rows = await listCustomsDeskRows(staff);
  if (!rows) return <Gate title="Customs Desk unavailable" detail="Firestore is not available for customs operations in this deployment."/>;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <CustomsWorkspace initialRows={rows}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#514840]"><section className="w-full max-w-xl rounded-[15px] border border-[#e6ded7] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Customs Desk</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="primary" data-size="md">Operations home</Link><Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="md">Shipments</Link></div></section></main>;
}
