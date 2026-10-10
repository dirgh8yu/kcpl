import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { currentBsMonth, loadTaxMonth } from "../tax-books.server";
import { loadVatPeriod } from "../vat-period-lock.server";
import { TaxWorkspace } from "./tax-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tax & books", robots: { index: false, follow: false } };

export default async function TaxPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Tax books are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile, isManagement: staff.permissions.role === "management" };
  const params = await searchParams;
  const current = currentBsMonth();
  const year = Number(params.y) || current.year;
  const month = Number(params.m) || current.month;
  const result = await loadTaxMonth(staff, year, month);
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Finance access is restricted" detail="Tax books are available to Management and Accounts roles only."/></OperationsShell>;
  if (result.kind === "invalid") return <OperationsShell {...shellProps}><Gate embedded title="That month isn't in the calendar" detail="Choose a Nepali month between 2070 and 2100."/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Tax books didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  const period = await loadVatPeriod(staff, year, month).catch(() => null);
  return <OperationsShell {...shellProps}><TaxWorkspace month={result.month} period={period} currentYear={current.year}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Tax & books" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }]}/>;
}
