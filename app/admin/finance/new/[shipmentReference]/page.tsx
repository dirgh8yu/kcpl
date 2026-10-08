import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { getStaffContext } from "../../../staff-directory.server";
import { V4WorkspaceGate } from "../../../v4-workspace-gate";
import { resolveInvoiceCustomerFromShipment } from "../../finance-linking.server";
import { ShipmentInvoiceForm } from "./shipment-invoice-form";
import { recordTitle } from "../../../../record-title";

export const dynamic = "force-dynamic";
/** The tab names the record, so a row of open tabs and the history read as
 *  a list of shipments and invoices rather than the same word repeated. */
export async function generateMetadata({ params }: { params: Promise<{ shipmentReference: string }> }) {
  const name = recordTitle((await params).shipmentReference);
  return { title: `New invoice for ${name}`, robots: { index: false, follow: false } };
}

export default async function NewShipmentInvoicePage({ params }: { params: Promise<{ shipmentReference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Invoice creation is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, isManagement: staff.permissions.role === "management" };
  // Past sign-in, gates keep the staff frame.
  const shellGate = (title: string, detail: string) => <OperationsShell {...shellProps}><Gate title={title} detail={detail} embedded/></OperationsShell>;
  if (!staff.permissions.canManageFinance) return shellGate("Finance access is restricted", "Invoice creation is available to Management and Accounts roles only.");

  const { shipmentReference } = await params;
  const reference = decodeURIComponent(shipmentReference).trim().toUpperCase();
  const linked = await resolveInvoiceCustomerFromShipment(reference);

  if (linked.kind === "shipment_missing") return shellGate("Shipment not found", "No shipment has that reference.");
  if (linked.kind === "unavailable") return shellGate("Finance didn’t load", "Something went wrong fetching it. Try again in a minute; the menu and search still work.");

  return (
    <OperationsShell {...shellProps} detailLabel={`New invoice · ${reference}`}>
    <ShipmentInvoiceForm
      shipmentReference={reference}
      customerId={linked.kind === "resolved" ? linked.customerId : null}
      customerName={linked.kind === "resolved" ? linked.customerName : null}
      quoteReference={linked.kind === "unlinked" ? linked.quoteReference : null}
      suggestions={linked.kind === "unlinked" ? linked.suggestions : []}
    />
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Receivables" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }]}/>;
}
