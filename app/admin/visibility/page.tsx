import { getAdminAccess } from "../admin-auth";
import "./visibility-premium.css";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
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
  try {
    result = await listTrackingVisibility(staff);
  } catch (error) {
    console.error("Failed to load KCPL tracking visibility", error);
    return <OperationsShell {...shell}><Gate title="Visibility temporarily unavailable" detail="KCPL tracking data could not be loaded. Navigation remains available and no shipment records have been changed." embedded/></OperationsShell>;
  }
  if (result.kind !== "ready") return <OperationsShell {...shell}><Gate title="Visibility backend unavailable" detail="Tracking storage is not available for this deployment." embedded/></OperationsShell>;
  const { shipment } = await searchParams;
  const initialShipment = shipment?.trim().toUpperCase() ?? "";
  return <OperationsShell {...shell}><TrackingVisibilityWorkspace initialRows={result.rows} initialSummary={result.summary} canSweep={staff.permissions.role === "management"} initialShipment={initialShipment}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Live Visibility"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/shipments", label: "Shipments", primary: true },
      { href: "/admin/command-centre", label: "Operations Overview" },
    ]}
  />;
}
