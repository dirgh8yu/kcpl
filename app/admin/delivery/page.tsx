import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listDeliveryWorkspace } from "./delivery-control.server";
import { DeliveryWorkspace } from "./delivery-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery & POD | KCPL Operations", robots: { index: false, follow: false } };

export default async function DeliveryPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Delivery & POD Control is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate embedded title="Delivery access restricted" detail="Digital Job File access is required for Delivery & POD Control."/></OperationsShell>;
  try {
    const workspace = await listDeliveryWorkspace(staff);
    if (workspace.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Delivery backend unavailable" detail="Firebase delivery data is not available for this deployment."/></OperationsShell>;
    return <OperationsShell {...shellProps}><DeliveryWorkspace initialRows={workspace.rows} initialSummary={workspace.summary}/></OperationsShell>;
  } catch (error) {
    console.error("Failed to load KCPL Delivery & POD Control", error);
    return <OperationsShell {...shellProps}><Gate embedded title="Delivery Control could not be loaded" detail="KCPL operational data is temporarily unavailable. No delivery records have been changed."/></OperationsShell>;
  }
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#514840] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[15px] border border-[#e5ddd6] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Delivery & POD</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/shipments" className="ops-button" data-variant="primary" data-size="md">Shipments</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Operations</Link></div></section></main>;
}
