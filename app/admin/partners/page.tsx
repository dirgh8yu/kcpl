import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { canEditPartnerNetwork, canViewPartnerFinance } from "./partner-policy";
import { getStaffContext } from "../staff-directory.server";
import { Partner360Jump } from "./partner-360-jump";
import { PartnersWorkspace } from "./partners-workspace";
import { listPartnerDashboard } from "./partners.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partners & Vendors | KCPL Operations", robots: { index: false, follow: false } };

export default async function PartnersPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="The partner network is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);

  let dashboard;
  try {
    dashboard = await listPartnerDashboard(staff);
  } catch (error) {
    console.error("Failed to load KCPL partner network", error);
    return <Gate title="Partner network could not be loaded" detail="KCPL supplier and counterpart data is temporarily unavailable."/>;
  }
  if (!dashboard) return <Gate title="Partner network is unavailable" detail="The Firebase partner registry is not available for this deployment."/>;

  const canEdit = canEditPartnerNetwork(staff.permissions);
  const canEditGlobal = canEdit && (staff.permissions.role === "management" || staff.can_access_all_branches);
  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <Partner360Jump partners={dashboard.partners.map((partner) => ({ id: partner.id, display_name: partner.display_name }))}/>
      <PartnersWorkspace
        dashboard={dashboard}
        canEdit={canEdit}
        canEditGlobal={canEditGlobal}
        editableOwnerBranches={staff.branches}
        commercialVisible={staff.permissions.canViewCommercial}
        financialVisible={canViewPartnerFinance(staff.permissions)}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Partner Network</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/partners" className="rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Partners</Link><Link href="/admin/command-centre" className="rounded-[11px] border border-[#e2d9d2] bg-white px-4 py-2.5 text-[10px] font-bold text-[#665c55]">Operations Home</Link></div></section></main>;
}
