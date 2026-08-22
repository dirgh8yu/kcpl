import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OperationsShell } from "../operations-shell";
import { listPartnerOptions } from "../partners/partners.server";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { getStaffContext } from "../staff-directory.server";
import { listPayablesDashboard } from "./payables.server";
import { PayablesWorkspace } from "./payables-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts Payable | KCPL Finance", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Accounts Payable", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

async function loadWorkspace(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try {
    const [dashboard, partnerOptions] = await Promise.all([
      listPayablesDashboard(staff),
      listPartnerOptions(staff),
    ]);
    return dashboard && partnerOptions ? { kind: "ready" as const, dashboard, partnerOptions } : { kind: "unavailable" as const };
  } catch (error) {
    console.error("Failed to load KCPL Accounts Payable", error);
    return { kind: "error" as const };
  }
}

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ shipment?: string; partner?: string; create?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Accounts Payable is available only to authorised KCPL staff."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} isManagement={permissions.role === "management"}><Gate title="Accounts Payable could not be loaded" detail="KCPL payable data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate title="Accounts Payable is restricted" detail="Supplier bills and payments are available to Management and Accounts roles only." embedded/></OperationsShell>;

  const loaded = await loadWorkspace(staff);
  if (loaded.kind !== "ready") return <OperationsShell {...shellProps}><Gate title={loaded.kind === "error" ? "Accounts Payable could not be loaded" : "Accounts Payable is unavailable"} detail="The payable ledger or Partner registry is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  const params = await searchParams;
  const initialShipment = typeof params.shipment === "string" ? params.shipment.trim().toUpperCase() : "";
  const requestedPartner = typeof params.partner === "string" ? params.partner.trim().toUpperCase() : "";
  const initialPartner = loaded.partnerOptions.some((partner) => partner.id === requestedPartner) ? requestedPartner : "";
  const initialCreate = params.create === "1";
  const branchOptions = (staff.can_access_all_branches ? [...kcplBranches] : staff.branches) as KcplBranch[];
  const defaultBranch = branchOptions[0] ?? "Kathmandu";

  return (
    <OperationsShell {...shellProps}>
      <PayablesWorkspace
        dashboard={loaded.dashboard}
        roleLabel={kcplStaffRoleLabels[staff.permissions.role]}
        initialShipment={initialShipment}
        initialPartner={initialPartner}
        initialCreate={initialCreate}
        partnerOptions={loaded.partnerOptions}
        branchOptions={branchOptions}
        defaultBranch={defaultBranch}
      />
      <div className="fixed bottom-5 right-5 z-40"><Link href="/admin/freight-audit" className="ops-button shadow-[0_8px_28px_rgba(54,43,34,.10)]" data-variant="primary" data-size="sm">Freight Audit & Match-Pay</Link></div>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#332d29] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[18px] border border-[#e6ddd6] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Finance</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/finance" className="rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Receivables</Link><Link href="/admin/command-centre" className="rounded-[11px] border border-[#e2d9d2] bg-white px-4 py-2.5 text-[10px] font-bold text-[#665c55]">Operations Home</Link></div></section></main>;
}
