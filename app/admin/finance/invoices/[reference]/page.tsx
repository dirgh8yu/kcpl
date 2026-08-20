import Link from "next/link";
import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { getStaffContext } from "../../../staff-directory.server";
import { kcplStaffRoleLabels } from "../../../staff-permissions";
import { getFinanceInvoice } from "../../finance.server";
import { InvoiceWorkspace } from "./invoice-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice | KCPL Finance", robots: { index: false, follow: false } };

export default async function InvoicePage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Invoices are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Finance access is restricted" detail="Invoices and Accounts Receivable are available to Management and Accounts roles only."/>;
  const { reference } = await params;
  const result = await getFinanceInvoice(reference, staff);
  if (result.kind === "missing") return <Gate title="Invoice not found" detail="This invoice reference does not exist."/>;
  if (result.kind === "forbidden") return <Gate title="Outside your finance access" detail="This invoice belongs to a branch outside your staff scope."/>;
  if (result.kind === "unavailable") return <Gate title="Finance unavailable" detail="The Firestore finance backend is unavailable for this deployment."/>;
  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];
  return <OperationsShell userName={access.user.displayName} roleLabel={roleLabel} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}><InvoiceWorkspace invoice={result.invoice} roleLabel={roleLabel}/></OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Finance</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><Link href="/admin/finance" className="ops-button ops-button-primary mt-6">Back to Finance</Link></section></main>;
}
