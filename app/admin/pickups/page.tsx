import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listPickupWorkspace } from "./pickup-appointments.server";
import { PickupAppointmentsWorkspace } from "./pickup-appointments-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pickup Scheduling | KCPL Operations", robots: { index: false, follow: false } };

export default async function PickupPage({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Pickup & Appointment Scheduling is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, isManagement: staff.permissions.role === "management" };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate embedded title="Pickup access restricted" detail="Digital Job File access is required for Pickup & Appointment Scheduling."/></OperationsShell>;
  let result: Awaited<ReturnType<typeof listPickupWorkspace>>;
  try { result = await listPickupWorkspace(staff); }
  catch (error) { console.error("Failed to load KCPL Pickup Scheduling", error); result = { kind: "unavailable" as const }; }
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Pickup Scheduling unavailable" detail="Firebase pickup data is temporarily unavailable. Existing bookings and shipment records have not been changed."/></OperationsShell>;
  const params = await searchParams;
  return <OperationsShell {...shellProps}><PickupAppointmentsWorkspace initialRows={result.rows} initialSummary={result.summary} initialReference={(params.shipment ?? "").trim().toUpperCase()}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#514840] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[15px] border border-[#e5ddd6] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Pickup Scheduling</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/tenders" className="ops-button" data-variant="primary" data-size="md">Tender & Booking</Link><Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="md">Shipments</Link></div></section></main>;
}
