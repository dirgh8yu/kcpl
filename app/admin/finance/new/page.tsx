import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { NewReceivableWorkspace } from "./new-receivable-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Receivable | KCPL Finance", robots: { index: false, follow: false } };

export default async function NewReceivablePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Receivable creation is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Finance access is restricted" detail="Customer invoices are available to Management and Accounts roles only."/>;

  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
      <NewReceivableWorkspace />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8"><p className="ops-eyebrow">KCPL Receivables</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/finance" className="ops-button" data-variant="primary" data-size="md">Receivables</Link><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations Home</Link></div></section></main>;
}
