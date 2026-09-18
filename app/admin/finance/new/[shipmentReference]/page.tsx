import { getAdminAccess } from "../../../admin-auth";
import { getStaffContext } from "../../../staff-directory.server";
import { V4WorkspaceGate } from "../../../v4-workspace-gate";
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
      customerName={linked.kind === "resolved" ? linked.customerName : null}
      quoteReference={linked.kind === "unlinked" ? linked.quoteReference : null}
      suggestions={linked.kind === "unlinked" ? linked.suggestions : []}
    />
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance" title={title} detail={detail} actions={[{ href: "/admin/finance", label: "Finance", primary: true }, { href: "/admin/command-centre", label: "Operations Home" }]}/>;
}
