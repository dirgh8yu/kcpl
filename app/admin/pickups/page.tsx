import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listPickupWorkspace } from "./pickup-appointments.server";
import { PickupAppointmentsWorkspace } from "./pickup-appointments-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pickups | KCPL Operations", robots: { index: false, follow: false } };

export default async function PickupPage({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Pickup & Appointment Scheduling is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate embedded title="Pickup access restricted" detail="Your role doesn’t include shipments. Ask Management if you need it."/></OperationsShell>;
  let result: Awaited<ReturnType<typeof listPickupWorkspace>>;
  try { result = await listPickupWorkspace(staff); }
  catch (error) { console.error("Failed to load KCPL Pickups", error); result = { kind: "unavailable" as const }; }
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Pickups didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  const params = await searchParams;
  return <OperationsShell {...shellProps}><PickupAppointmentsWorkspace initialRows={result.rows} initialSummary={result.summary} initialReference={(params.shipment ?? "").trim().toUpperCase()}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Pickups"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/tenders", label: "Carrier booking", primary: true },
      { href: "/admin/shipments", label: "Shipments" },
    ]}
  />;
}
