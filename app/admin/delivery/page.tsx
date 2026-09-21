import { getAdminAccess } from "../admin-auth";
import { loadCommandCentre } from "../command-centre/command-centre.server";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listDeliveryWorkspace } from "./delivery-control.server";
import { DeliveryWorkspace } from "./delivery-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery & POD | KCPL Operations", robots: { index: false, follow: false } };

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Delivery & POD Control is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate embedded title="Delivery access restricted" detail="Digital Job File access is required for Delivery & POD Control."/></OperationsShell>;

  let workspace: Awaited<ReturnType<typeof listDeliveryWorkspace>>;
  try {
    workspace = await listDeliveryWorkspace(staff);
  } catch (error) {
    console.error("Failed to load KCPL Delivery & POD Control", error);
    return <OperationsShell {...shellProps}><Gate embedded title="Delivery Control could not be loaded" detail="KCPL operational data is temporarily unavailable. No delivery records have been changed."/></OperationsShell>;
  }

  if (workspace.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Delivery backend unavailable" detail="Firebase delivery data is not available for this deployment."/></OperationsShell>;
  const { shipment } = await searchParams;
  const initialQuery = shipment?.trim().toUpperCase() ?? "";
  // The pulse strip is additive: a snapshot failure must not take down the
  // delivery queue, so it loads independently of the workspace above.
  const pulseData = await loadCommandCentre(staff, { includeDelivered: true }).catch(() => null);
  return <OperationsShell {...shellProps}><DeliveryWorkspace initialRows={workspace.rows} initialSummary={workspace.summary} initialQuery={initialQuery} pulseData={pulseData}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Delivery & POD"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/shipments", label: "Shipments", primary: true },
      { href: "/admin/command-centre", label: "Operations Overview" },
    ]}
  />;
}
