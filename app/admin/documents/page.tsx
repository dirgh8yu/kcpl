import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listDocumentVault } from "./documents-data.server";
import { DocumentsWorkspace } from "./documents-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Document Vault | KCPL Operations", robots: { index: false, follow: false } };

export default async function DocumentsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The Document Vault is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate title="Document Vault unavailable" detail="Shipment document access is not available for this staff role." embedded/></OperationsShell>;

  let dashboard: Awaited<ReturnType<typeof listDocumentVault>>;
  try {
    dashboard = await listDocumentVault(staff);
  } catch (error) {
    console.error("Failed to load KCPL Document Vault", error);
    return <OperationsShell {...shellProps}><Gate title="Document Vault could not be loaded" detail="KCPL document data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  if (!dashboard) return <OperationsShell {...shellProps}><Gate title="Document Vault unavailable" detail="Firestore is not available for shipment document control in this deployment. Navigation and search remain available." embedded/></OperationsShell>;

  return (
    <OperationsShell {...shellProps}>
      <DocumentsWorkspace dashboard={dashboard} role={staff.permissions.role} currentUserEmail={access.user.email}/>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Document Vault"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/command-centre", label: "Operations Overview", primary: true },
      { href: "/admin/shipments", label: "Shipments" },
    ]}
  />;
}
