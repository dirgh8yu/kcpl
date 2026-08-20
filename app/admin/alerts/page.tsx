import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { evaluateAutomationRules, listAutomationAlerts } from "./alert-engine.server";
import { AlertsWorkspace } from "./alerts-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts & Escalations | KCPL", robots: { index: false, follow: false } };

type LoadResult =
  | { kind: "ready"; roleLabel: string; alerts: NonNullable<Awaited<ReturnType<typeof listAutomationAlerts>>> }
  | { kind: "unavailable" }
  | { kind: "error" };

async function loadPage(user: { uid: string; email: string; displayName: string }): Promise<LoadResult> {
  try {
    const staff = await getStaffContext(user);
    await evaluateAutomationRules();
    const alerts = await listAutomationAlerts(staff, user.email);
    if (!alerts) return { kind: "unavailable" };
    return { kind: "ready", roleLabel: kcplStaffRoleLabels[staff.permissions.role], alerts };
  } catch (error) {
    console.error("Failed to load KCPL automation alerts", error);
    return { kind: "error" };
  }
}

export default async function AlertsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Alerts and escalations are available only to authorised KCPL staff." />;
  const result = await loadPage(access.user);
  if (result.kind === "unavailable") return <Gate title="Automation storage is unavailable." detail="Firebase is not available for the alerts engine in this deployment." />;
  if (result.kind === "error") return <Gate title="Alerts could not be loaded." detail="KCPL automation data is temporarily unavailable." />;
  return <AlertsWorkspace initialAlerts={result.alerts} roleLabel={result.roleLabel} />;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-xs font-black uppercase tracking-[.22em] text-[#b78a3e]">KCPL Automation</p><h1 className="mt-4 text-3xl font-black tracking-[-.04em]">{title}</h1><p className="mt-4 text-sm leading-7 text-black/60">{detail}</p><Link href="/admin" className="mt-8 inline-block rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">Back to Operations</Link></section></main>;
}
