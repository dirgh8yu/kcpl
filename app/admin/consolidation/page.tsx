import "../plan-sell-premium.css";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { listTmsOrders } from "../rating/tms-rating.server";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listCurrentConsolidationAllocationViews } from "./tms-consolidation-allocation.server";
import { TmsConsolidationAllocationDesk } from "./tms-consolidation-allocation-desk";
import { listConsolidationLoads } from "./tms-consolidation.server";
import { TmsConsolidationWorkspace } from "./tms-consolidation-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Load planning", robots: { index: false, follow: false } };

export default async function ConsolidationPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL Load planning is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canViewCommercial) return <OperationsShell {...shellProps}><Gate title="Commercial access required" detail="Consolidation planning contains procurement-sensitive transport orders and costs." embedded/></OperationsShell>;

  let loads: Awaited<ReturnType<typeof listConsolidationLoads>>;
  let orders: Awaited<ReturnType<typeof listTmsOrders>>;
  try {
    [loads, orders] = await Promise.all([listConsolidationLoads(staff), listTmsOrders(staff)]);
  } catch (error) {
    console.error("Failed to load KCPL Load planning", error);
    return <OperationsShell {...shellProps}><Gate title="Load planning didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  }

  if (loads.kind !== "ready" || orders.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Load planning didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

  let allocations: Awaited<ReturnType<typeof listCurrentConsolidationAllocationViews>>;
  try { allocations = await listCurrentConsolidationAllocationViews(loads.loads.map((load) => load.id), staff); }
  catch { allocations = new Map(); }

  return (
    <OperationsShell {...shellProps}>
      <TmsConsolidationWorkspace
        initialLoads={loads.loads}
        initialOrders={orders.orders}
        canManage={staff.permissions.canEditCommercial}
        allocation={<TmsConsolidationAllocationDesk key="allocation"
          initialLoads={loads.loads}
          initialAllocations={Object.fromEntries(allocations)}
          canPrepare={staff.permissions.canEditCommercial}
          canApprove={staff.permissions.role === "management"}
        />}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="Load planning"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[{ href: "/admin/rating", label: "Rate desk", primary: true }]}
  />;
}
