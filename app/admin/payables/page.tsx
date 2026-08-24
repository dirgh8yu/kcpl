import { getAdminAccess } from "../admin-auth";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OperationsShell } from "../operations-shell";
import { listPartnerOptions } from "../partners/partners.server";
import { kcplStaffRoleLabels, staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listPayablesDashboard } from "./payables.server";
import { PayablesWorkspace } from "./payables-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts Payable | KCPL Finance", robots: { index: false, follow: false } };

type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try { return { kind: "ready", staff: await getStaffContext(user) }; }
  catch (error) { console.error("Failed to resolve KCPL staff context for Accounts Payable", error); return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) }; }
}

async function loadWorkspace(staff: Awaited<ReturnType<typeof getStaffContext>>) {
  try {
    const [dashboard, partnerOptions] = await Promise.all([listPayablesDashboard(staff), listPartnerOptions(staff)]);
    return dashboard && partnerOptions ? { kind: "ready" as const, dashboard, partnerOptions } : { kind: "unavailable" as const };
  } catch (error) {
    console.error("Failed to load KCPL Accounts Payable", error);
    return { kind: "error" as const };
  }
}

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ shipment?: string; partner?: string; create?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Accounts Payable is available only to authorised KCPL staff."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate title="Accounts Payable could not be loaded" detail="KCPL payable data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate title="Accounts Payable is restricted" detail="Supplier bills and payments are available to Management and Accounts roles only." embedded/></OperationsShell>;

  const loaded = await loadWorkspace(staff);
  if (loaded.kind !== "ready") return <OperationsShell {...shellProps}><Gate title={loaded.kind === "error" ? "Accounts Payable could not be loaded" : "Accounts Payable is unavailable"} detail="The payable ledger or Partner registry is temporarily unavailable. Navigation and search remain available." embedded/></OperationsShell>;

  const params = await searchParams;
  const initialShipment = typeof params.shipment === "string" ? params.shipment.trim().toUpperCase() : "";
  const requestedPartner = typeof params.partner === "string" ? params.partner.trim().toUpperCase() : "";
  const initialPartner = loaded.partnerOptions.some((partner) => partner.id === requestedPartner) ? requestedPartner : "";
  const initialCreate = params.create === "1";
  const branchOptions = (staff.can_access_all_branches ? [...kcplBranches] : staff.branches) as KcplBranch[];
  const defaultBranch = branchOptions[0] ?? "Kathmandu";

  return <OperationsShell {...shellProps}><PayablesWorkspace dashboard={loaded.dashboard} roleLabel={kcplStaffRoleLabels[staff.permissions.role]} initialShipment={initialShipment} initialPartner={initialPartner} initialCreate={initialCreate} partnerOptions={loaded.partnerOptions} branchOptions={branchOptions} defaultBranch={defaultBranch}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance · Payables" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/payables", label: "Payables", primary: true }, { href: "/admin/freight-audit", label: "Freight Audit" }, { href: "/admin/finance", label: "Receivables" }]}/>;
}
