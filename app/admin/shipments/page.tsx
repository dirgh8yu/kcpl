import "./shipments-premium.css";
import { getAdminAccess } from "../admin-auth";
import { loadCommandCentre } from "../command-centre/command-centre.server";
import { getStaffContext } from "../staff-directory.server";
import { OperationsShell } from "../operations-shell";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { ShipmentsWorkspace } from "./shipments-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipments | KCPL Operations", robots: { index: false, follow: false } };

export default async function ShipmentsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The shipment register is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate title="Shipment access restricted" detail="Your KCPL staff role does not currently include Digital Job File access." embedded/></OperationsShell>;

  let data;
  try {
    data = await loadCommandCentre(staff, { includeDelivered: true });
  } catch (error) {
    console.error("Failed to load KCPL shipment queue", error);
    return <OperationsShell {...shellProps}><Gate title="Shipments could not be loaded" detail="KCPL operational data is temporarily unavailable. Navigation and search remain available and no shipment records have been changed." embedded/></OperationsShell>;
  }

  if (!data) return <OperationsShell {...shellProps}><Gate title="Shipment backend unavailable" detail="Firestore is not available for this deployment. Navigation and search remain available." embedded/></OperationsShell>;

  return <OperationsShell {...shellProps}><ShipmentsWorkspace data={data} canStartShipment={staff.permissions.canViewCommercial}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Shipments"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/command-centre", label: "Operations Overview", primary: true },
      { href: "/admin/shipments", label: "Shipments" },
    ]}
  />;
}
