import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { getPartner360Snapshot } from "../partner-360.server";
import { Partner360Workspace } from "./partner-360-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner 360 | KCPL Operations", robots: { index: false, follow: false } };

export default async function Partner360Page({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Partner 360 is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const { id } = await params;
  const partnerId = decodeURIComponent(id).trim().toUpperCase();
  if (!/^KCPL-P-[A-Z0-9-]+$/.test(partnerId)) return <Gate title="Partner reference is invalid" detail="The requested Partner 360 record does not use a valid KCPL partner reference."/>;

  let result;
  try {
    result = await getPartner360Snapshot(partnerId, staff);
  } catch (error) {
    console.error("Failed to load KCPL Partner 360", partnerId, error);
    return <Gate title="Partner 360 could not be loaded" detail="KCPL partner relationship data is temporarily unavailable."/>;
  }

  if (result.kind === "unavailable") return <Gate title="Partner network is unavailable" detail="The Firebase Partner registry is not available for this deployment."/>;
  if (result.kind === "missing") return <Gate title="Partner not found" detail="This partner or vendor record does not exist."/>;
  if (result.kind === "forbidden") return <Gate title="Partner access restricted" detail="This partner belongs to a KCPL branch outside your assigned access."/>;

  return <OperationsShell
    userName={access.user.displayName}
    canManageStaff={staff.permissions.canManageStaff}
    canManageFinance={staff.permissions.canManageFinance}
    isManagement={staff.permissions.role === "management"}
  >
    <Partner360Workspace
      snapshot={result.snapshot}
      commercialVisible={staff.permissions.canViewCommercial}
      financialVisible={staff.permissions.canManageFinance}
    />
  </OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Partner 360</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/partners" className="rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Back to Partners</Link><Link href="/admin/command-centre" className="rounded-[11px] border border-[#e2d9d2] bg-white px-4 py-2.5 text-[10px] font-bold text-[#665c55]">Operations Home</Link></div></section></main>;
}
