import { listInvoiceRemittancesForStaff } from "../../../../portal/portal-remittance.server";
import { getAdminAccess } from "../../../admin-auth";
import { OperationsShell } from "../../../operations-shell";
import { getStaffContext } from "../../../staff-directory.server";
import { V4WorkspaceGate } from "../../../v4-workspace-gate";
import { getFinanceInvoice } from "../../finance.server";
import { mockFinanceDashboard, qaMockDataEnabled } from "../../../qa-fixtures";
import { InvoiceWorkspace } from "./invoice-workspace";
import { recordTitle } from "../../../../record-title";

export const dynamic = "force-dynamic";
/** The tab names the record, so a row of open tabs and the history read as
 *  a list of shipments and invoices rather than the same word repeated. */
export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  const name = recordTitle((await params).reference);
  return { title: name, robots: { index: false, follow: false } };
}

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
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate embedded title="Finance access is restricted" detail="Invoices are available to Management and Accounts roles only."/></OperationsShell>;

  const { reference } = await params;
  // QA preview: the same invoices the Receivables register lists.
  const mockInvoice = qaMockDataEnabled() ? mockFinanceDashboard(staff).invoices.find((item) => item.reference === reference.trim().toUpperCase()) : undefined;
  const result = qaMockDataEnabled()
    ? (mockInvoice ? { kind: "ready" as const, invoice: mockInvoice } : { kind: "missing" as const })
    : await getFinanceInvoice(reference, staff);
  if (result.kind === "missing") return <OperationsShell {...shellProps}><Gate embedded title="Invoice not found" detail="This invoice reference does not exist."/></OperationsShell>;
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Outside your finance access" detail="This invoice belongs to a branch outside your staff scope."/></OperationsShell>;
  if (result.kind === "relationship_mismatch") return <OperationsShell {...shellProps}><Gate embedded title="This invoice needs fixing" detail="Its customer and shipment belong to different branches. Management needs to fix the link before it can be opened."/></OperationsShell>;
  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Finance didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;

  // What the customer sent from the portal or app against this invoice.
  const remittances = qaMockDataEnabled() ? [] : await listInvoiceRemittancesForStaff(result.invoice.reference).catch((error) => {
    console.error("KCPL admin remittance listing failed", error);
    return [];
  });

  return <OperationsShell {...shellProps}><InvoiceWorkspace invoice={result.invoice} remittances={remittances}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="Invoice" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/finance", label: "Receivables", primary: true }]}/>;
}
