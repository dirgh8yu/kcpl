import Link from "next/link";
import { getAdminAccess } from "../../../admin-auth";
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

  return (
    <ShipmentInvoiceForm
      shipmentReference={reference}
      customerId={linked.kind === "resolved" ? linked.customerId : null}
      quoteReference={linked.kind === "unlinked" ? linked.quoteReference : null}
    />
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Finance</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/finance" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Finance</Link><Link href="/admin" className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">Operations</Link></div></section></main>;
}
