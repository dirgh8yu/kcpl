import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { getStaffContext } from "../../../staff-directory.server";
import { kcplStaffRoleLabels } from "../../../staff-permissions";
import { V4WorkspaceGate } from "../../../v4-workspace-gate";
import { getFinanceInvoice } from "../../finance.server";
import { InvoiceWorkspace } from "./invoice-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice | KCPL Finance", robots: { index: false, follow: false } };

export default async function InvoicePage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Invoices are available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate embedded title="Finance access is restricted" detail="Invoices and Accounts Receivable are available to Management and Accounts roles only."/></OperationsShell>;

  const { reference } = await params;
  const result = await getFinanceInvoice(reference, staff);
  if (result.kind === "missing") return <OperationsShell {...shellProps}><Gate embedded title="Invoice not found" detail="This invoice reference does not exist."/></OperationsShell>;
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Outside your finance access" detail="This invoice belongs to a branch outside your staff scope."/></OperationsShell>;
  if (result.kind === "relationship_mismatch") return <OperationsShell {...shellProps}><Gate embedded title="Invoice relationship requires repair" detail="This invoice is linked to customer or shipment records with incompatible canonical scope and cannot be opened until the relationship is repaired."/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Finance unavailable" detail="The Firestore finance backend is unavailable for this deployment."/></OperationsShell>;

  return <OperationsShell {...shellProps}><InvoiceWorkspace invoice={result.invoice} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance · Invoice" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }, { href: "/admin/payables", label: "Payables" }]}/>;
}
