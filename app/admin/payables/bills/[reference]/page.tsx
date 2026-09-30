import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { getStaffContext } from "../../../staff-directory.server";
import { V4WorkspaceGate } from "../../../v4-workspace-gate";
import { getPayable } from "../../payables.server";
import { mockPayablesDashboard, qaMockDataEnabled } from "../../../qa-fixtures";
import { PayableWorkspace } from "./payable-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Supplier Bill | KCPL Accounts Payable", robots: { index: false, follow: false } };

export default async function PayableBillPage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Supplier bills are available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate embedded title="Accounts Payable is restricted" detail="Supplier bills are available to Management and Accounts roles only."/></OperationsShell>;

  const { reference } = await params;
  // QA preview: the same bills the Payables register lists.
  const mockBill = qaMockDataEnabled() ? mockPayablesDashboard(staff).bills.find((item) => item.reference === reference.trim().toUpperCase()) : undefined;
  const result = qaMockDataEnabled()
    ? (mockBill ? { kind: "ready" as const, bill: mockBill } : { kind: "missing" as const })
    : await getPayable(reference, staff);
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Supplier bills didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  if (result.kind === "missing") return <OperationsShell {...shellProps}><Gate embedded title="Supplier bill not found" detail="This payable reference does not exist."/></OperationsShell>;
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Outside your branch access" detail="This supplier bill belongs to a branch outside your staff profile."/></OperationsShell>;

  return <OperationsShell {...shellProps}><PayableWorkspace bill={result.bill}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance · Supplier Bill" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/payables", label: "Payables", primary: true }, { href: "/admin/freight-audit", label: "Freight Audit" }, { href: "/admin/finance", label: "Receivables" }]}/>;
}
