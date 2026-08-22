import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listTrackingVisibility } from "./tracking-visibility.server";
import { TrackingVisibilityWorkspace } from "./tracking-visibility-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Visibility | KCPL Operations", robots: { index: false, follow: false } };

export default async function VisibilityPage({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Live shipment visibility is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shell = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shell}><Gate title="Visibility access restricted" detail="Your role does not include Digital Job File access." embedded/></OperationsShell>;
  let result;
  try { result = await listTrackingVisibility(staff); }
  catch (error) {
    console.error("Failed to load KCPL tracking visibility", error);
    return <OperationsShell {...shell}><Gate title="Visibility temporarily unavailable" detail="KCPL tracking data could not be loaded. Navigation remains available and no shipment records have been changed." embedded/></OperationsShell>;
  }
  if (result.kind !== "ready") return <OperationsShell {...shell}><Gate title="Visibility backend unavailable" detail="Tracking storage is not available for this deployment." embedded/></OperationsShell>;
  const { shipment } = await searchParams;
  const initialQuery = shipment?.trim().toUpperCase() ?? "";
  return <OperationsShell {...shell}><div className="ops-content-wide pt-4"><div className="flex justify-end"><Link href="/admin/carrier-integrations" className="ops-button" data-variant="secondary" data-size="sm">Carrier integrations →</Link></div></div><TrackingVisibilityWorkspace initialRows={result.rows} initialSummary={result.summary} canSweep={staff.permissions.role === "management"} initialQuery={initialQuery}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#514840] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[15px] border border-[#e5ddd6] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Live Visibility</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/shipments" className="ops-button" data-variant="primary" data-size="md">Shipments</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Operations</Link></div></section></main>;
}
