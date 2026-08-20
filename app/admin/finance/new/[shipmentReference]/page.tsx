import Link from "next/link";
import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { kcplStaffRoleLabels } from "../../../staff-permissions";
import { getStaffContext } from "../../../staff-directory.server";
import { resolveInvoiceCustomerFromShipment } from "../../finance-linking.server";
import { ShipmentInvoiceForm } from "./shipment-invoice-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create Invoice | KCPL Finance", robots: { index: false, follow: false } };

export default async function NewShipmentInvoicePage({ params }: { params: Promise<{ shipmentReference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Invoice creation is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return <Gate title="Finance access is restricted" detail="Invoice creation is available to Management and Accounts roles only."/>;

  const { shipmentReference } = await params;
  const reference = decodeURIComponent(shipmentReference).trim().toUpperCase();
  const linked = await resolveInvoiceCustomerFromShipment(reference);
  if (linked.kind === "shipment_missing") return <Gate title="Shipment not found" detail="The shipment reference does not exist."/>;
  if (linked.kind === "unavailable") return <Gate title="Finance unavailable" detail="Customer linking is temporarily unavailable."/>;

  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];
  return <OperationsShell userName={access.user.displayName} roleLabel={roleLabel} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
    <ShipmentInvoiceForm shipmentReference={reference} customerId={linked.kind === "resolved" ? linked.customerId : null} customerName={linked.kind === "resolved" ? linked.customerName : null} quoteReference={linked.kind === "unlinked" ? linked.quoteReference : null} suggestions={linked.kind === "unlinked" ? linked.suggestions : []}/>
  </OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Finance</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/finance" className="ops-button ops-button-primary">Finance & AR</Link><Link href="/admin/shipments" className="ops-button ops-button-secondary">Shipments</Link></div></section></main>;
}
