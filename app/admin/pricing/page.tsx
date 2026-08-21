import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { listPricingWorkspace } from "./tms-pricing.server";
import { TmsPricingWorkspace } from "./tms-pricing-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing Desk | KCPL Operations", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try {
    return { kind: "ready", staff: await getStaffContext(user) };
  } catch (error) {
    console.error("Failed to resolve KCPL staff context for Pricing Desk", error);
    return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) };
  }
}

async function loadWorkspace(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try {
    return await listPricingWorkspace(staff);
  } catch (error) {
    console.error("Failed to load KCPL Pricing Desk", error);
    return { kind: "error" as const };
  }
}

export default async function PricingPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Pricing Desk is available only to authorised staff."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} isManagement={permissions.role === "management"}><Gate title="Pricing Desk could not be loaded" detail="KCPL pricing data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Sell pricing contains customer-specific rates, procurement costs and margin controls." embedded/></OperationsShell>;

  const workspace = await loadWorkspace(staff);
  if (workspace.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Pricing Desk unavailable" detail="KCPL transport-order, CRM or pricing-rule storage is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  return (
    <OperationsShell {...shellProps}>
      <TmsPricingWorkspace initialOrders={workspace.orders} initialCustomers={workspace.customers} initialRules={workspace.rules} canManageRules={staff.permissions.canManageRateCards} canApprove={staff.permissions.role === "management"}/>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#342f2b] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8 shadow-[0_18px_50px_rgba(67,49,38,.06)]"><p className="ops-eyebrow">KCPL Pricing Desk</p><h1 className="mt-3 text-[27px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/rating" className="ops-button" data-variant="primary" data-size="md">Rate Desk</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Enquiries</Link></div></section></main>;
}
