import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { PartnersWorkspace } from "./partners-workspace";
import { listPartnerDashboard } from "./partners.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partners & Vendors | KCPL Operations", robots: { index: false, follow: false } };

export default async function PartnersPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="The partner network is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);

  let dashboard;
  try {
    dashboard = await listPartnerDashboard();
  } catch (error) {
    console.error("Failed to load KCPL partner network", error);
    return <Gate title="Partner network could not be loaded." detail="KCPL supplier and counterpart data is temporarily unavailable. Existing records remain protected."/>;
  }
  if (!dashboard) return <Gate title="Partner network is unavailable." detail="The Firebase partner registry is not available for this deployment."/>;

  const canEdit = staff.permissions.role !== "operations";
  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={kcplStaffRoleLabels[staff.permissions.role]}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <PartnersWorkspace dashboard={dashboard} canEdit={canEdit}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Partner Network</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="inline-flex h-9 items-center rounded-lg bg-[#283a77] px-4 text-xs font-semibold text-white">Enquiry desk</Link><Link href="/admin/command-centre" className="inline-flex h-9 items-center rounded-lg border border-[#dfe2e6] px-4 text-xs font-semibold text-[#505861]">Operations Home</Link></div></section></main>;
}
