import "../../organisation-premium.css";
import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { currentBsMonth } from "../../finance/tax-books.server";
import { fiscalYearOf, marginPeriod } from "../account-margin";
import { loadAccountMargins } from "../account-margin.server";
import { CommissionWorkspace } from "./commission-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Margin by manager", robots: { index: false, follow: false } };

/** `p` is "m:2083-6" for a Nepali month or "fy:2083" for the fiscal year starting Shrawan 2083. */
function periodParams(value: string | undefined) {
  const fiscal = value?.match(/^fy:(\d{4})$/);
  if (fiscal) return { fy: fiscal[1] };
  const month = value?.match(/^m:(\d{4})-(\d{1,2})$/);
  return month ? { y: month[1], m: month[2] } : {};
}

export default async function CommissionPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Margin by account manager is available only to KCPL Management."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  if (staff.permissions.role !== "management") return <OperationsShell {...shellProps}><Gate embedded title="Management access required" detail="Margin and commission by account manager is restricted to the Management role."/></OperationsShell>;

  const current = currentBsMonth();
  const period = marginPeriod(periodParams((await searchParams).p), current);
  if (!period) return <OperationsShell {...shellProps}><Gate embedded title="That period isn't in the calendar" detail="Choose a Nepali month or fiscal year from the list."/></OperationsShell>;
  const result = await loadAccountMargins(staff, period).catch((error) => { console.error("KCPL margin by manager failed", error); return { kind: "unavailable" as const }; });
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Margin by manager didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  return <OperationsShell {...shellProps}><CommissionWorkspace report={result.report} current={current} currentFiscalYear={fiscalYearOf(current.year, current.month)}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Reports" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/management", label: "Management", primary: true }]}/>;
}
