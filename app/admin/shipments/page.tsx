import "./shipments-premium.css";
import { getAdminAccess } from "../admin-auth";
import { loadCommandCentre } from "../command-centre/command-centre.server";
import { getLaneCompletionsByStaff, getReceivableExposureByCustomer } from "../command-centre/receivable-exposure.server";
import type { ReceivableExposure } from "../command-centre/work-queue-impact";
import { getStaffContext } from "../staff-directory.server";
import { OperationsShell } from "../operations-shell";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { ShipmentsWorkspace } from "./shipments-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipments", robots: { index: false, follow: false } };

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
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate title="Shipment access restricted" detail="Your KCPL staff role does not currently include shipment record access." embedded/></OperationsShell>;

  let data;
  try {
    data = await loadCommandCentre(staff, { includeDelivered: true });
  } catch (error) {
    console.error("Failed to load KCPL shipment queue", error);
    return <OperationsShell {...shellProps}><Gate title="Shipments didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  }

  if (!data) return <OperationsShell {...shellProps}><Gate title="Shipments didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

  // Ranking and suggestion inputs load additively: a failure must never take
  // down the register, it only degrades to severity-only order and no
  // suggestions.
  const [exposureByCustomer, laneCompletionsByStaff] = await Promise.all([
    getReceivableExposureByCustomer(staff).catch((error) => {
      console.error("Failed to load KCPL receivable exposure for shipments", error);
      return new Map<string, ReceivableExposure>();
    }),
    getLaneCompletionsByStaff(staff).catch((error) => {
      console.error("Failed to load KCPL lane completions for shipments", error);
      return new Map<string, Map<string, { lane_completions: number; last_lane_completion_at: string | null }>>();
    }),
  ]);

  return <OperationsShell {...shellProps}><ShipmentsWorkspace data={data} canStartShipment={staff.permissions.canViewCommercial} exposureByCustomer={exposureByCustomer} laneCompletionsByStaff={laneCompletionsByStaff} currentStaff={{ uid: access.user.uid, email: access.user.email }}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Shipments" title={title} detail={detail} embedded={embedded}/>;
}
