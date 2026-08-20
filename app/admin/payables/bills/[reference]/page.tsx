import Link from "next/link";
import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { kcplStaffRoleLabels } from "../../../staff-permissions";
import { getStaffContext } from "../../../staff-directory.server";
import { getPayable } from "../../payables.server";
import { PayableWorkspace } from "./payable-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supplier Bill | KCPL Accounts Payable", robots: { index: false, follow: false } };

export default async function PayableBillPage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Supplier bills are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Accounts Payable is restricted" detail="Supplier bills are available to Management and Accounts roles only."/>;
  const { reference } = await params;
  const result = await getPayable(reference, staff);
  if (result.kind === "unavailable") return <Gate title="Accounts Payable unavailable" detail="The Firestore payable ledger is unavailable for this deployment."/>;
  if (result.kind === "missing") return <Gate title="Supplier bill not found" detail="This payable reference does not exist."/>;
  if (result.kind === "forbidden") return <Gate title="Outside your branch access" detail="This supplier bill belongs to a branch outside your staff profile."/>;
  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];
  return <OperationsShell userName={access.user.displayName} roleLabel={roleLabel} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}><PayableWorkspace bill={result.bill} roleLabel={roleLabel}/></OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Accounts Payable</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/payables" className="ops-button ops-button-primary">Accounts Payable</Link><Link href="/admin/finance" className="ops-button ops-button-secondary">Finance & AR</Link></div></section></main>;
}
