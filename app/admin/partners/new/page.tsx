import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { canEditPartnerNetwork } from "../partner-policy";
import type { PartnerOwnerBranch } from "../partners-data";
import { NewPartnerWorkspace } from "./new-partner-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Partner | KCPL Operations", robots: { index: false, follow: false } };

export default async function NewPartnerPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Partner creation is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const canEdit = canEditPartnerNetwork(staff.permissions);
  if (!canEdit) return <Gate title="Partner editing is restricted" detail="Your current KCPL role has read-only Partner Network access."/>;

  const canGlobal = staff.permissions.role === "management" || staff.can_access_all_branches;
  const ownerOptions: PartnerOwnerBranch[] = [...(canGlobal ? ["Global" as const] : []), ...staff.branches];
  if (!ownerOptions.length) return <Gate title="No editable branch is assigned" detail="A KCPL branch assignment is required before you can create a Partner record."/>;

  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
      <NewPartnerWorkspace ownerOptions={ownerOptions}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8"><p className="ops-eyebrow">KCPL Partner Network</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/partners" className="ops-button" data-variant="primary" data-size="md">Partners</Link><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations Home</Link></div></section></main>;
}
