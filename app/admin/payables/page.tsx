import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OperationsShell } from "../operations-shell";
import { listPartnerOptions } from "../partners/partners.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { getStaffContext } from "../staff-directory.server";
import { listPayablesDashboard } from "./payables.server";
import { PayablesWorkspace } from "./payables-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts Payable | KCPL Finance", robots: { index: false, follow: false } };

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ shipment?: string; partner?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Accounts Payable is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Accounts Payable is restricted" detail="Supplier bills and payments are available to Management and Accounts roles only."/>;

  const [dashboard, partnerOptions] = await Promise.all([
    listPayablesDashboard(staff),
    listPartnerOptions(staff),
  ]);
  if (!dashboard || !partnerOptions) return <Gate title="Accounts Payable is unavailable" detail="The payable ledger or Partner registry is not available for this deployment."/>;

  const params = await searchParams;
  const initialShipment = typeof params.shipment === "string" ? params.shipment.trim().toUpperCase() : "";
  const requestedPartner = typeof params.partner === "string" ? params.partner.trim().toUpperCase() : "";
  const initialPartner = partnerOptions.some((partner) => partner.id === requestedPartner) ? requestedPartner : "";
  const branchOptions = (staff.can_access_all_branches ? [...kcplBranches] : staff.branches) as KcplBranch[];
  const defaultBranch = branchOptions[0] ?? "Kathmandu";

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <PayablesWorkspace
        dashboard={dashboard}
        roleLabel={kcplStaffRoleLabels[staff.permissions.role]}
        initialShipment={initialShipment}
        initialPartner={initialPartner}
        partnerOptions={partnerOptions}
        branchOptions={branchOptions}
        defaultBranch={defaultBranch}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Finance</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/finance" className="rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Receivables</Link><Link href="/admin/command-centre" className="rounded-[11px] border border-[#e2d9d2] bg-white px-4 py-2.5 text-[10px] font-bold text-[#665c55]">Operations Home</Link></div></section></main>;
}
