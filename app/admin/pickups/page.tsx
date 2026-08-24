import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listPickupWorkspace } from "./pickup-appointments.server";
import { PickupAppointmentsWorkspace } from "./pickup-appointments-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pickup Scheduling | KCPL Operations", robots: { index: false, follow: false } };

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
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate embedded title="Pickup access restricted" detail="Digital Job File access is required for Pickup & Appointment Scheduling."/></OperationsShell>;
  let result: Awaited<ReturnType<typeof listPickupWorkspace>>;
  try { result = await listPickupWorkspace(staff); }
  catch (error) { console.error("Failed to load KCPL Pickup Scheduling", error); result = { kind: "unavailable" as const }; }
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Pickup Scheduling unavailable" detail="Firebase pickup data is temporarily unavailable. Existing bookings and shipment records have not been changed."/></OperationsShell>;
  const params = await searchParams;
  return <OperationsShell {...shellProps}><PickupAppointmentsWorkspace initialRows={result.rows} initialSummary={result.summary} initialReference={(params.shipment ?? "").trim().toUpperCase()}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Pickup Scheduling"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/tenders", label: "Tender & Booking", primary: true },
      { href: "/admin/shipments", label: "Shipments" },
    ]}
  />;
}
