import Link from "next/link";
import { getAdminAccess } from "../../../admin-auth";
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
  return <PayableWorkspace bill={result.bill} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Accounts Payable</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/payables" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Accounts Payable</Link><Link href="/admin/finance" className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">Accounts Receivable</Link></div></section></main>;
}
