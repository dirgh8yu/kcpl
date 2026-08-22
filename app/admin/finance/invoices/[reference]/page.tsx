import Link from "next/link";
import { getAdminAccess } from "../../../admin-auth";
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
  if (result.kind === "relationship_mismatch") return <Gate title="Invoice relationship requires repair" detail="This invoice is linked to customer or shipment records with incompatible canonical scope and cannot be opened until the relationship is repaired."/>;
  if (result.kind === "unavailable") return <Gate title="Finance unavailable" detail="The Firestore finance backend is unavailable for this deployment."/>;
  return <InvoiceWorkspace invoice={result.invoice} roleLabel={kcplStaffRoleLabels[staff.permissions.role]}/>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Finance</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><Link href="/admin/finance" className="mt-6 inline-block rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Back to Finance</Link></section></main>;
}
