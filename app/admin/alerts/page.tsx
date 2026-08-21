import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { listAutomationAlerts } from "./alert-engine.server";
import { AlertsWorkspace } from "./alerts-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks & Alerts | KCPL Operations", robots: { index: false, follow: false } };

type LoadResult =
  | {
      kind: "ready";
      roleLabel: string;
      alerts: NonNullable<Awaited<ReturnType<typeof listAutomationAlerts>>>;
      canManageStaff: boolean;
      canManageFinance: boolean;
      isManagement: boolean;
    }
  | { kind: "unavailable" }
  | { kind: "error" };

async function loadPage(user: { uid: string; email: string; displayName: string }): Promise<LoadResult> {
  try {
    const staff = await getStaffContext(user);
    const alerts = await listAutomationAlerts(staff, user.email, true);
    if (!alerts) return { kind: "unavailable" };
    return {
      kind: "ready",
      roleLabel: kcplStaffRoleLabels[staff.permissions.role],
      alerts,
      canManageStaff: staff.permissions.canManageStaff,
      canManageFinance: staff.permissions.canManageFinance,
      isManagement: staff.permissions.role === "management",
    };
  } catch (error) {
    console.error("Failed to load KCPL automation alerts", error);
    return { kind: "error" };
  }
}

export default async function AlertsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Tasks and alerts are available only to authorised KCPL staff." />;
  const result = await loadPage(access.user);
  if (result.kind === "unavailable") return <Gate title="Alert storage unavailable" detail="Firestore is not available for the alerts workspace in this deployment." />;
  if (result.kind === "error") return <Gate title="Tasks & alerts could not be loaded" detail="KCPL operational alert data is temporarily unavailable." />;

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={result.canManageStaff}
      canManageFinance={result.canManageFinance}
      isManagement={result.isManagement}
    >
      <AlertsWorkspace initialAlerts={result.alerts} roleLabel={result.roleLabel} />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#514840]"><section className="w-full max-w-xl rounded-[15px] border border-[#e6ded7] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Attention Desk</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="primary" data-size="md">Operations home</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Enquiries</Link></div></section></main>;
}
